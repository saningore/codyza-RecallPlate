import { FSIS_ENDPOINT, FSIS_USER_AGENT, PAGE_SIZE, failureDetail } from "@/lib/copy";
import { fetchUpstream } from "@/lib/http";
import { parseRecallNumber } from "@/lib/query";
import type { FsisRecord, FsisSection, RecentReport, SearchInput, SourceFailure } from "@/lib/types";
import { calendarDate, clean, failureKind, fsisGroup, fsisUrl, matchesClass, plain, withinDates } from "@/lib/text";

const FSIS_LIST_KEYS = ["results", "data", "recalls", "items"] as const;

function rowsFrom(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of FSIS_LIST_KEYS) {
    if (key in record) return Array.isArray(record[key]) ? record[key] as unknown[] : null;
  }
  return null;
}

export function fsisReadable(record: FsisRecord): boolean {
  return Boolean(record.recallNumber || record.title || record.products || record.summary);
}

export function interpretFsisCatalog(bodyText: string): { ok: true; records: FsisRecord[] } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText) as unknown;
  } catch {
    return { ok: false };
  }
  const rows = rowsFrom(parsed);
  if (!rows) return { ok: false };
  const records = rows.map(normalizeFsis).filter((row): row is FsisRecord => Boolean(row && fsisReadable(row)));
  if (rows.length > 0 && records.length === 0) return { ok: false };
  return { ok: true, records };
}

export function normalizeFsis(value: unknown): FsisRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const recallType = plain(row.field_recall_type);
  const date = calendarDate(row.field_recall_date) ?? calendarDate(row.field_last_modified_date) ?? clean(plain(row.field_recall_date));
  return {
    source: "fsis",
    recallNumber: plain(row.field_recall_number),
    title: plain(row.field_title) ?? plain(row.title),
    recallType,
    classification: plain(row.field_recall_classification),
    riskLevel: plain(row.field_risk_level),
    group: fsisGroup(recallType),
    reason: plain(row.field_recall_reason),
    summary: plain(row.field_summary),
    products: plain(row.field_product_items),
    establishment: plain(row.field_establishment),
    states: plain(row.field_states),
    processing: plain(row.field_processing),
    quantity: plain(row.field_qty_recovered),
    date,
    closedYear: plain(row.field_closed_year),
    url: fsisUrl(row.field_recall_url),
    retailList: fsisUrl(row.field_distro_list),
    labels: linkList(row.field_labels),
    mediaContact: plain(row.field_company_media_contact) ?? plain(row.field_media_contact),
  };
}

function linkList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  const urls = items.map((item) => fsisUrl(item)).filter((item): item is string => Boolean(item));
  return [...new Set(urls)];
}

export function completeJsonObjects(raw: string): unknown[] {
  const start = raw.indexOf("[");
  if (start < 0) return [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (char === "}" && depth === 1) end = index;
    }
  }
  if (end < 0) return [];
  try {
    const parsed = JSON.parse(`${raw.slice(start, end + 1)}]`) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function blob(record: FsisRecord): string {
  return [record.title, record.products, record.summary, record.establishment, record.reason, record.recallNumber, record.states]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function fsisMatches(record: FsisRecord, input: SearchInput): boolean {
  const number = parseRecallNumber(input.q);
  if (number) return record.recallNumber === number.number;
  const haystack = blob(record);
  const term = input.q.trim().toLowerCase();
  const words = term.split(/\s+/).filter((word) => word.length > 1);
  const textMatch = input.separateWords ? words.every((word) => haystack.includes(word)) : haystack.includes(term);
  if (!textMatch) return false;
  if (input.status === "ongoing" && record.group !== "active") return false;
  if (input.status === "historical" && record.group !== "closed") return false;
  if (input.class !== "all") {
    const joined = `${record.classification ?? ""} ${record.riskLevel ?? ""}`;
    if (!matchesClass(joined, input.class)) return false;
  }
  if (!withinDates(calendarDate(record.date), input.from, input.to)) return false;
  return true;
}

const FSIS_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": FSIS_USER_AGENT,
  Referer: "https://www.fsis.usda.gov/recalls",
};

let catalogCache: { at: number; records: FsisRecord[] } | null = null;

async function loadRecords(): Promise<{ records: FsisRecord[] } | { failure: SourceFailure }> {
  if (catalogCache && Date.now() - catalogCache.at < 15 * 60_000) return { records: catalogCache.records };
  try {
    const response = await fetchUpstream(FSIS_ENDPOINT, 60_000, FSIS_HEADERS);
    if (response.status !== 200) return catalogCache ? { records: catalogCache.records } : { failure: "unavailable" };
    const read = interpretFsisCatalog(response.bodyText);
    if (!read.ok || !read.records.length) return catalogCache ? { records: catalogCache.records } : { failure: "unreadable" };
    const records = [...read.records].sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
    catalogCache = { at: Date.now(), records };
    return { records };
  } catch (error) {
    if (catalogCache) return { records: catalogCache.records };
    return { failure: failureKind(error) };
  }
}

export async function searchFsis(input: SearchInput): Promise<FsisSection> {
  try {
    const catalog = await loadRecords();
    if ("failure" in catalog) return emptyError(catalog.failure);
    const matched = catalog.records.filter((record) => fsisMatches(record, input));
    const all = matched;
    const recalls = all.filter((record) => record.group !== "alert");
    const alerts = all.filter((record) => record.group === "alert");
    const start = ((input.fsisPage ?? input.page) - 1) * PAGE_SIZE;
    const records = recalls.slice(start, start + PAGE_SIZE);
    const alertPage = alerts.slice(start, start + PAGE_SIZE);
    const state = records.length || alertPage.length ? "ok" : "empty";
    return {
      state,
      failure: null,
      detail: state === "empty" ? "The FSIS recall API returned no rows for this search." : "USDA FSIS recall and public health alert records.",
      retrievedAt: new Date().toISOString(),
      recallTotal: recalls.length,
      alertTotal: alerts.length,
      records,
      alerts: alertPage,
    };
  } catch (error) {
    return emptyError(failureKind(error));
  }
}

function emptyError(failure: SourceFailure): FsisSection {
  return {
    state: "error",
    failure,
    detail: failureDetail("fsis", failure),
    retrievedAt: null,
    recallTotal: 0,
    alertTotal: 0,
    records: [],
    alerts: [],
  };
}

export async function recentFsis(): Promise<RecentReport["fsis"]> {
  try {
    const loaded = await loadRecords();
    if ("failure" in loaded) {
      return { state: "error", failure: loaded.failure, detail: failureDetail("fsis", loaded.failure), active: [], closed: [], alerts: [] };
    }
    return {
      state: "ok",
      failure: null,
      detail: "Newest USDA FSIS records in the cached public list, sorted by the date FSIS published.",
      active: loaded.records.filter((record) => record.group === "active").slice(0, 4),
      closed: loaded.records.filter((record) => record.group === "closed").slice(0, 3),
      alerts: loaded.records.filter((record) => record.group === "alert").slice(0, 3),
    };
  } catch (error) {
    const failure = failureKind(error);
    return { state: "error", failure, detail: failureDetail("fsis", failure), active: [], closed: [], alerts: [] };
  }
}

export async function fsisByNumber(recallNumber: string): Promise<{ state: "ok" | "empty" | "error"; record: FsisRecord | null; failure: SourceFailure | null; detail: string | null }> {
  const section = await searchFsis({
    q: recallNumber,
    page: 1,
    status: "all",
    class: "all",
    separateWords: false,
    from: null,
    to: null,
  });
  if (section.state === "error") return { state: "error", record: null, failure: section.failure, detail: section.detail };
  const record = [...section.records, ...section.alerts].find((item) => item.recallNumber === recallNumber) ?? null;
  return { state: record ? "ok" : "empty", record, failure: null, detail: null };
}
