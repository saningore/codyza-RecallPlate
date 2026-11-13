import { ENTER_QUERY, MAX_SKIP, PAGE_SIZE, QUERY_LIMIT } from "@/lib/copy";
import type { ClassFilter, SearchInput, StatusFilter } from "@/lib/types";
import { validDate } from "@/lib/text";

const FDA_NUMBER = /^[A-Za-z]{1,3}-\d{3,5}-\d{4}$/;
const FSIS_NUMBER = /^(?:\d{2,4}-\d{4}|PHA-\d{8}-\d{2})$/i;

export type RecallNumber =
  | { kind: "fda"; number: string }
  | { kind: "fsis"; number: string };

export function parseRecallNumber(query: string): RecallNumber | null {
  const trimmed = query.trim();
  if (FDA_NUMBER.test(trimmed)) {
    return { kind: "fda", number: trimmed.toUpperCase() };
  }
  if (FSIS_NUMBER.test(trimmed)) return { kind: "fsis", number: trimmed.toUpperCase() };
  return null;
}

export function sanitizeTerm(input: string): string {
  return input.replace(/["\\]/g, " ").replace(/[(){}[\]^~*?:&|!]/g, " ").replace(/\s+/g, " ").trim();
}

export function isFdaNumber(value: string): boolean {
  return FDA_NUMBER.test(value);
}

export function isFsisNumber(value: string): boolean {
  return FSIS_NUMBER.test(value);
}

function phrase(term: string): string {
  return `"${term}"`;
}

function fieldGroup(term: string): string {
  const quoted = phrase(term);
  return `(product_description:${quoted} OR recalling_firm:${quoted} OR reason_for_recall:${quoted} OR code_info:${quoted} OR distribution_pattern:${quoted})`;
}

export function buildFdaQuery(input: Pick<SearchInput, "q" | "status" | "class" | "separateWords" | "from" | "to">): string {
  const number = parseRecallNumber(input.q);
  const parts: string[] = [];
  if (number?.kind === "fda") {
    parts.push(`recall_number:"${number.number}"`);
  } else if (input.separateWords) {
    const words = sanitizeTerm(input.q).split(" ").filter((word) => word.length > 1);
    parts.push(words.map((word) => fieldGroup(word)).join(" AND "));
  } else {
    parts.push(fieldGroup(sanitizeTerm(input.q)));
  }
  if (input.status === "ongoing") parts.push('status:"Ongoing"');
  if (input.status === "historical") parts.push('(status:"Completed" OR status:"Terminated")');
  if (input.class === "I") parts.push('classification:"Class I"');
  if (input.class === "II") parts.push('classification:"Class II"');
  if (input.class === "III") parts.push('classification:"Class III"');
  if (input.class === "unclassified") parts.push('classification:"Not Yet Classified"');
  if (input.from || input.to) {
    const start = input.from ? input.from.replace(/-/g, "") : "*";
    const end = input.to ? input.to.replace(/-/g, "") : "*";
    parts.push(`recall_initiation_date:[${start} TO ${end}]`);
  }
  return parts.join(" AND ");
}

export function pageWindow(page: number): { skip: number; error: string | null } {
  if (!Number.isInteger(page) || page < 1) return { skip: 0, error: "Page must be 1 or greater." };
  const skip = (page - 1) * PAGE_SIZE;
  if (skip > MAX_SKIP) {
    return { skip, error: "openFDA will not return results past 25,000 matching records. Narrow the search." };
  }
  return { skip, error: null };
}

function one(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim() ?? "";
}

export function parseSearchParams(params: URLSearchParams): { ok: true; value: SearchInput } | { ok: false; error: string } {
  const q = one(params, "q");
  if (!q) return { ok: false, error: ENTER_QUERY };
  if (q.length > QUERY_LIMIT) return { ok: false, error: "Enter a shorter search. The limit is 120 characters." };
  const sanitized = sanitizeTerm(q);
  if (!parseRecallNumber(q) && !sanitized) return { ok: false, error: ENTER_QUERY };
  const page = Number(one(params, "page") || "1");
  if (!Number.isInteger(page) || page < 1 || page > 2000) return { ok: false, error: "Page must be 1 or greater." };
  const status = one(params, "status") || "all";
  const klass = one(params, "class") || "all";
  if (!["all", "ongoing", "historical"].includes(status)) return { ok: false, error: "That status filter is not available." };
  if (!["all", "I", "II", "III", "unclassified"].includes(klass)) return { ok: false, error: "That class filter is not available." };
  const fromRaw = one(params, "from");
  const toRaw = one(params, "to");
  const from = fromRaw ? validDate(fromRaw.slice(0, 4), fromRaw.slice(5, 7), fromRaw.slice(8, 10)) : null;
  const to = toRaw ? validDate(toRaw.slice(0, 4), toRaw.slice(5, 7), toRaw.slice(8, 10)) : null;
  if (fromRaw && !from) return { ok: false, error: "The start date is not a real calendar date." };
  if (toRaw && !to) return { ok: false, error: "The end date is not a real calendar date." };
  if (from && to && from > to) return { ok: false, error: "The start date is after the end date." };
  const window = pageWindow(page);
  if (window.error) return { ok: false, error: window.error };
  const fdaPage = readPage(params, "fdaPage", page);
  const fsisPage = readPage(params, "fsisPage", page);
  const noticePage = readPage(params, "noticePage", page);
  if (!fdaPage.ok) return fdaPage;
  if (!fsisPage.ok) return fsisPage;
  if (!noticePage.ok) return noticePage;
  return {
    ok: true,
    value: {
      q,
      page,
      fdaPage: fdaPage.page,
      fsisPage: fsisPage.page,
      noticePage: noticePage.page,
      status: status as StatusFilter,
      class: klass as ClassFilter,
      separateWords: one(params, "words") === "1",
      from,
      to,
    },
  };
}

function readPage(params: URLSearchParams, key: string, fallback: number): { ok: true; page: number } | { ok: false; error: string } {
  const raw = one(params, key);
  if (!raw) return { ok: true, page: fallback };
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1 || page > 2000) return { ok: false, error: "Page must be 1 or greater." };
  const window = pageWindow(page);
  if (window.error) return { ok: false, error: window.error };
  return { ok: true, page };
}
