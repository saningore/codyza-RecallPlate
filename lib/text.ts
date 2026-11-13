import { CLASS_DEFINITIONS, MISSING, NO_MATCH } from "@/lib/copy";
import type { FdaGroup, FsisGroup } from "@/lib/types";

export function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : null;
}

export function decodeEntities(value: string): string {
  let text = value;
  for (let pass = 0; pass < 2; pass += 1) {
    text = text
      .replace(/&#(\d+);/g, (_, digits: string) => {
        const code = Number(digits);
        return code > 0 && code < 65536 ? String.fromCharCode(code) : "";
      })
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&apos;|&#0?39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return text;
}

export function htmlToText(value: string): string {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<[^>]+>/g, " "));
}

export function plain(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const decoded = value.includes("&") ? decodeEntities(value) : value;
    return clean(decoded.includes("<") ? htmlToText(decoded) : decoded);
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const parts = value.map((item) => plain(item)).filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("url" in record || "uri" in record) {
      const url = plain(record.url ?? record.uri);
      if (url) return url;
    }
    if ("processed" in record) {
      const processed = plain(record.processed);
      if (processed) return processed;
    }
    if ("value" in record) return plain(record.value);
  }
  return null;
}

export function show(value: string | null): string {
  return value && value.trim() ? value : MISSING;
}

export function fdaGroup(status: string | null): FdaGroup {
  if (!status) return "other";
  if (/^ongoing$/i.test(status.trim())) return "ongoing";
  if (/^(completed|terminated)$/i.test(status.trim())) return "historical";
  return "other";
}

export function fsisGroup(recallType: string | null): FsisGroup {
  if (!recallType) return "other";
  if (/public health alert/i.test(recallType)) return "alert";
  if (/closed/i.test(recallType)) return "closed";
  if (/active/i.test(recallType)) return "active";
  return "other";
}

export function displayStatus(status: string | null, source: "fda" | "fsis"): string {
  if (!status) return MISSING;
  if (source === "fda" && fdaGroup(status) === "ongoing") return `Current enforcement status: ${status}`;
  if (source === "fda" && fdaGroup(status) === "historical") return `Historical enforcement status: ${status}`;
  if (source === "fsis" && fsisGroup(status) === "alert") return "USDA public health alert";
  if (source === "fsis" && fsisGroup(status) === "active") return `Current FSIS status: ${status}`;
  if (source === "fsis" && fsisGroup(status) === "closed") return `Historical FSIS status: ${status}`;
  return status;
}

export function classMention(value: string | null): "Class I" | "Class II" | "Class III" | "Not Yet Classified" | null {
  if (!value) return null;
  if (/not yet classified/i.test(value)) return "Not Yet Classified";
  if (/\bClass III\b/i.test(value)) return "Class III";
  if (/\bClass II\b/i.test(value)) return "Class II";
  if (/\bClass I\b/i.test(value)) return "Class I";
  return null;
}

export function classDefinition(value: string | null): string | null {
  const mention = classMention(value);
  return mention ? CLASS_DEFINITIONS[mention] : null;
}

export function matchesClass(value: string | null, filter: "I" | "II" | "III" | "unclassified"): boolean {
  const mention = classMention(value);
  if (filter === "unclassified") return mention === "Not Yet Classified";
  if (filter === "I") return mention === "Class I";
  if (filter === "II") return mention === "Class II";
  return mention === "Class III";
}

export function resultMessage(input: {
  fda: "ok" | "empty" | "error";
  fsis: "ok" | "empty" | "error";
  notices: "ok" | "empty" | "error";
}): string | null {
  const states = [input.fda, input.fsis, input.notices];
  if (states.some((state) => state === "ok")) return null;
  if (states.every((state) => state === "error")) return null;
  if (states.some((state) => state === "empty")) return NO_MATCH;
  return null;
}

export function finiteTotal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function failureKind(error: unknown): "timeout" | "unavailable" {
  return error instanceof Error && error.message === "timeout" ? "timeout" : "unavailable";
}

export function searchAnnouncement(report: {
  query: string;
  message: string | null;
  fda: { state: "ok" | "empty" | "error"; detail: string; total: number };
  fsis: { state: "ok" | "empty" | "error"; detail: string; recallTotal: number };
  notices: { state: "ok" | "empty" | "error"; detail: string };
}): string {
  const failed = [report.fda, report.fsis, report.notices].filter((section) => section.state === "error").map((section) => section.detail);
  if (report.message) return [report.message, ...failed].join(" ");
  const parts = [`Results for ${report.query}.`];
  if (report.fda.state === "ok") parts.push(`${report.fda.total} FDA enforcement records.`);
  if (report.fsis.state === "ok") parts.push(`${report.fsis.recallTotal} USDA recalls.`);
  return [...parts, ...failed].join(" ");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function calendarDate(value: unknown): string | null {
  const raw = plain(value);
  if (!raw) return null;
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return validDate(compact[1], compact[2], compact[3]);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(iso[1], iso[2], iso[3]);
  return null;
}

export function validDate(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${year}-${month}-${day}`;
}

export function shownDate(value: string | null): string {
  if (!value) return MISSING;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatCalendarDate(value) : value;
}

export function formatCalendarDate(iso: string | null): string {
  if (!iso) return MISSING;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const month = MONTHS[date.getUTCMonth()];
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function withinDates(iso: string | null, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

export function levenshtein(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[left.length][right.length];
}

export function suggestToken(query: string, descriptions: string[]): string | null {
  const needle = query.toLowerCase();
  if (!/^[a-z]{4,}$/.test(needle)) return null;
  let best: string | null = null;
  for (const description of descriptions) {
    const words = description.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    for (const word of words) {
      if (word === needle || Math.abs(word.length - needle.length) > 1) continue;
      if (levenshtein(needle, word) !== 1) continue;
      if (!best || word < best) best = word;
    }
  }
  return best;
}

export function officialFdaUrl(recallNumber: string): string {
  const url = new URL("https://api.fda.gov/food/enforcement.json");
  url.searchParams.set("search", `recall_number:"${recallNumber}"`);
  url.searchParams.set("limit", "1");
  return url.toString();
}

export function enforcementReportUrl(recallNumber: string): string {
  const url = new URL("https://www.accessdata.fda.gov/scripts/ires/index.cfm");
  url.searchParams.set("Product", recallNumber);
  return url.toString();
}

export function fsisUrl(value: unknown): string | null {
  const raw = plain(value);
  if (!raw) return null;
  let candidate = raw;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) candidate = `https://www.fsis.usda.gov${candidate}`;
  if (/^http:\/\/(www\.)?fsis\.usda\.gov\b/i.test(candidate)) candidate = `https://${candidate.slice("http://".length)}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "www.fsis.usda.gov" && url.hostname !== "fsis.usda.gov") return null;
    url.protocol = "https:";
    url.hostname = "www.fsis.usda.gov";
    return url.toString();
  } catch {
    return null;
  }
}
