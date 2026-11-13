import { FDA_NOTICES, PAGE_SIZE, failureDetail } from "@/lib/copy";
import { remember } from "@/lib/cache";
import { fetchUpstream } from "@/lib/http";
import type { Notice, NoticeSection, SearchInput, SourceFailure } from "@/lib/types";
import { calendarDate, failureKind, validDate, withinDates } from "@/lib/text";

function decodeXml(value: string): string {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");
  for (let pass = 0; pass < 2; pass += 1) {
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;|&#0?39;/g, "'")
      .replace(/&#(\d+);/g, (_, digits: string) => {
        const code = Number(digits);
        return code > 0 && code < 65536 ? String.fromCharCode(code) : "";
      });
  }
  return text.replace(/\s+/g, " ").trim();
}

function tag(chunk: string, name: string): string {
  const match = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match?.[1] ?? "";
}

export function fdaNoticeUrl(link: string): string | null {
  try {
    const url = new URL(link.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== "www.fda.gov" && url.hostname !== "fda.gov") return null;
    url.protocol = "https:";
    url.hostname = "www.fda.gov";
    return url.toString();
  } catch {
    return null;
  }
}

const RSS_MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function publishedDate(value: string): string | null {
  const match = value.match(/(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  if (match) {
    const month = RSS_MONTHS[match[2]];
    if (!month) return null;
    return validDate(match[3], month, match[1].padStart(2, "0"));
  }
  return calendarDate(value);
}

export function interpretRss(xml: string): Notice[] | null {
  if (typeof xml !== "string" || !/<rss\b|<feed\b|<item\b/i.test(xml)) return null;
  const notices = parseRss(xml);
  const items = xml.match(/<item\b/gi)?.length ?? 0;
  if (items === 0 && /<entry\b/i.test(xml)) return null;
  if (items > 0 && notices.length === 0 && !/<link\b/i.test(xml)) return null;
  return notices;
}

export function parseRss(xml: string): Notice[] {
  return xml.split(/<item\b/i).slice(1).flatMap((chunk) => {
    const title = decodeXml(tag(chunk, "title"));
    const url = fdaNoticeUrl(decodeXml(tag(chunk, "link")));
    if (!title || !url) return [];
    const summary = decodeXml(tag(chunk, "description"));
    return [{
      title,
      url,
      published: publishedDate(decodeXml(tag(chunk, "pubDate"))),
      summary: summary || null,
    }];
  });
}

export function noticeMatches(notice: Notice, input: Pick<SearchInput, "q" | "separateWords" | "from" | "to">): boolean {
  if (!withinDates(notice.published, input.from, input.to)) return false;
  const haystack = `${notice.title} ${notice.summary ?? ""}`.toLowerCase();
  const term = input.q.trim().toLowerCase();
  if (input.separateWords) {
    const words = term.split(/\s+/).filter((word) => word.length > 1);
    return words.every((word) => haystack.includes(word));
  }
  return haystack.includes(term);
}

function noticeMiss(failure: SourceFailure): NoticeSection {
  return { state: "error", failure, detail: failureDetail("notice", failure), retrievedAt: null, total: 0, records: [] };
}

export async function searchNotices(input: SearchInput): Promise<NoticeSection> {
  try {
    const cached = await remember("fda-notices", 10 * 60_000, async () => {
      const response = await fetchUpstream(FDA_NOTICES, 12_000);
      if (response.status !== 200) throw new Error("unavailable");
      const notices = interpretRss(response.bodyText);
      if (!notices) throw new Error("unreadable");
      return notices;
    });
    if (!cached) return noticeMiss("unavailable");
    const matched = cached.filter((notice) => noticeMatches(notice, input));
    const start = ((input.noticePage ?? input.page) - 1) * PAGE_SIZE;
    return {
      state: matched.length ? "ok" : "empty",
      failure: null,
      detail: matched.length ? "FDA food safety recall notices." : "The FDA notice feed had no matching item.",
      retrievedAt: new Date().toISOString(),
      total: matched.length,
      records: matched.slice(start, start + PAGE_SIZE),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "unreadable") return noticeMiss("unreadable");
    if (error instanceof Error && error.message === "unavailable") return noticeMiss("unavailable");
    return noticeMiss(failureKind(error));
  }
}
