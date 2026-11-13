import { FDA_ENFORCEMENT, PAGE_SIZE, failureDetail } from "@/lib/copy";
import { fetchUpstream } from "@/lib/http";
import { buildFdaQuery, pageWindow } from "@/lib/query";
import type { FdaRecord, FdaSection, RecentReport, SearchInput, SourceFailure } from "@/lib/types";
import { calendarDate, clean, failureKind, fdaGroup, finiteTotal, plain, suggestToken } from "@/lib/text";

type FdaPayload = {
  meta?: {
    last_updated?: string;
    results?: { total?: number };
  };
  results?: unknown[];
  error?: { code?: string };
};

function readJson(bodyText: string): FdaPayload | null {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    return parsed && typeof parsed === "object" ? parsed as FdaPayload : null;
  } catch {
    return null;
  }
}

export function normalizeFda(value: unknown): FdaRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const status = clean(row.status);
  return {
    source: "fda",
    recallNumber: clean(row.recall_number),
    eventId: clean(row.event_id),
    status,
    classification: clean(row.classification),
    group: fdaGroup(status),
    productDescription: plain(row.product_description),
    reason: plain(row.reason_for_recall),
    firm: plain(row.recalling_firm),
    address1: plain(row.address_1),
    address2: plain(row.address_2),
    city: plain(row.city),
    state: plain(row.state),
    postalCode: plain(row.postal_code),
    country: plain(row.country),
    distribution: plain(row.distribution_pattern),
    quantity: plain(row.product_quantity),
    codeInfo: plain(row.code_info),
    moreCodeInfo: plain(row.more_code_info),
    initiationDate: calendarDate(row.recall_initiation_date),
    classificationDate: calendarDate(row.center_classification_date),
    reportDate: calendarDate(row.report_date),
    terminationDate: calendarDate(row.termination_date),
    voluntaryMandated: plain(row.voluntary_mandated),
    notification: plain(row.initial_firm_notification),
    productType: clean(row.product_type),
  };
}

export function fdaReadable(record: FdaRecord): boolean {
  return Boolean(record.recallNumber || record.productDescription || record.firm || record.reason);
}

export type FdaRead =
  | { outcome: "empty"; lastUpdated: string | null }
  | { outcome: "unavailable" }
  | { outcome: "unreadable" }
  | { outcome: "rows"; records: FdaRecord[]; dropped: number; total: number; lastUpdated: string | null };

export function interpretFdaPayload(status: number, payload: unknown): FdaRead {
  const lastUpdated = lastUpdatedFrom(payload);
  if (status === 404) return { outcome: "empty", lastUpdated };
  if (status !== 200) return { outcome: "unavailable" };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { outcome: "unreadable" };
  const body = payload as FdaPayload;
  if (!Array.isArray(body.results)) return { outcome: "unreadable" };
  const records = body.results
    .map(normalizeFda)
    .filter((row): row is FdaRecord => Boolean(row && fdaReadable(row)));
  if (body.results.length > 0 && records.length === 0) return { outcome: "unreadable" };
  if (!records.length) return { outcome: "empty", lastUpdated };
  const reported = finiteTotal(body.meta?.results?.total);
  return {
    outcome: "rows",
    records,
    dropped: body.results.length - records.length,
    total: reported != null && reported >= records.length ? reported : records.length,
    lastUpdated,
  };
}

function lastUpdatedFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const meta = (payload as FdaPayload).meta;
  return calendarDate(meta?.last_updated) ?? clean(meta?.last_updated);
}

function endpoint(search: string, limit: number, skip: number, count: string | null): string {
  const url = new URL(FDA_ENFORCEMENT);
  url.searchParams.set("search", search);
  if (count) url.searchParams.set("count", count);
  else {
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("skip", String(skip));
    url.searchParams.set("sort", "report_date:desc");
  }
  const key = process.env.OPENFDA_API_KEY?.trim();
  if (key) url.searchParams.set("api_key", key);
  return url.toString();
}

const fdaCache = new Map<string, { at: number; status: number; payload: FdaPayload | null }>();

async function readFda(search: string, limit: number, skip: number, count: string | null): Promise<{ status: number; payload: FdaPayload | null }> {
  const url = endpoint(search, limit, skip, count);
  const cacheKey = url.replace(/api_key=[^&]+/, "api_key");
  const hit = fdaCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { status: hit.status, payload: hit.payload };
  const response = await fetchUpstream(url, 12_000);
  const result = { status: response.status, payload: readJson(response.bodyText) };
  if (result.status === 200 || result.status === 404) fdaCache.set(cacheKey, { at: Date.now(), ...result });
  return result;
}

function totals(payload: FdaPayload | null): { ongoing: number | null; historical: number | null } {
  if (!Array.isArray(payload?.results)) return { ongoing: null, historical: null };
  let ongoing: number | null = null;
  let historical = 0;
  let sawHistorical = false;
  for (const item of payload.results) {
    if (!item || typeof item !== "object") continue;
    const term = clean((item as { term?: unknown }).term);
    const count = finiteTotal((item as { count?: unknown }).count);
    if (count == null) continue;
    if (term === "Ongoing") ongoing = count;
    if (term === "Completed" || term === "Terminated") {
      historical += count;
      sawHistorical = true;
    }
  }
  return { ongoing, historical: sawHistorical ? historical : null };
}

function fdaMiss(failure: SourceFailure | null, detail: string): FdaSection {
  return {
    state: "error",
    failure,
    detail,
    lastUpdated: null,
    total: 0,
    ongoingTotal: null,
    historicalTotal: null,
    records: [],
    truncated: false,
  };
}

export async function searchFda(input: SearchInput): Promise<FdaSection> {
  const window = pageWindow(input.fdaPage ?? input.page);
  if (window.error) return fdaMiss(null, window.error);
  const search = buildFdaQuery(input);
  try {
    const [page, count] = await Promise.all([
      readFda(search, PAGE_SIZE, window.skip, null),
      input.status === "all" ? readFda(search, PAGE_SIZE, 0, "status.exact") : Promise.resolve(null),
    ]);
    const read = interpretFdaPayload(page.status, page.payload);
    if (read.outcome === "unavailable" || read.outcome === "unreadable") return fdaMiss(read.outcome, failureDetail("fda", read.outcome));
    if (read.outcome === "empty") {
      return {
        state: "empty",
        failure: null,
        detail: "The FDA enforcement catalog returned no rows for this search.",
        lastUpdated: read.lastUpdated,
        total: 0,
        ongoingTotal: 0,
        historicalTotal: 0,
        records: [],
        truncated: false,
      };
    }
    const split = count ? totals(count.payload) : { ongoing: null, historical: null };
    const detail = read.dropped > 0 ? `${read.dropped} rows on this page could not be read and were left out.` : "FDA food enforcement records.";
    return {
      state: "ok",
      failure: null,
      detail,
      lastUpdated: read.lastUpdated,
      total: read.total,
      ongoingTotal: split.ongoing,
      historicalTotal: split.historical,
      records: read.records,
      truncated: read.total > 25_000,
    };
  } catch (error) {
    const failure = failureKind(error);
    return fdaMiss(failure, failureDetail("fda", failure));
  }
}

export async function recentFda(): Promise<RecentReport["fda"]> {
  try {
    const [ongoingRaw, historicalRaw] = await Promise.all([
      readFda('product_type:"Food" AND status:"Ongoing"', 4, 0, null),
      readFda('product_type:"Food" AND (status:"Completed" OR status:"Terminated")', 4, 0, null),
    ]);
    const ongoing = rowsFromFda(ongoingRaw.status, ongoingRaw.payload);
    const historical = rowsFromFda(historicalRaw.status, historicalRaw.payload);
    if (!ongoing.ok && !historical.ok) {
      return { state: "error", failure: ongoing.failure, detail: failureDetail("fda", ongoing.failure), lastUpdated: null, ongoing: [], historical: [] };
    }
    const ongoingRecords = ongoing.ok ? ongoing.records : [];
    const historicalRecords = historical.ok ? historical.records : [];
    const state = ongoingRecords.length || historicalRecords.length ? "ok" : "empty";
    const detail = !ongoing.ok || !historical.ok
      ? "Part of the latest FDA extract could not be checked. No row was added in its place."
      : state === "empty"
        ? "The latest FDA extract did not return these rows."
        : "Recently published FDA food enforcement records.";
    return {
      state,
      failure: null,
      detail,
      lastUpdated: ongoing.lastUpdated ?? historical.lastUpdated,
      ongoing: ongoingRecords,
      historical: historicalRecords,
    };
  } catch (error) {
    const failure = failureKind(error);
    return { state: "error", failure, detail: failureDetail("fda", failure), lastUpdated: null, ongoing: [], historical: [] };
  }
}

function rowsFromFda(status: number, payload: FdaPayload | null): { ok: boolean; failure: SourceFailure; records: FdaRecord[]; lastUpdated: string | null } {
  const read = interpretFdaPayload(status, payload);
  if (read.outcome === "unavailable" || read.outcome === "unreadable") {
    return { ok: false, failure: read.outcome, records: [], lastUpdated: null };
  }
  return {
    ok: true,
    failure: "unavailable",
    records: read.outcome === "rows" ? read.records : [],
    lastUpdated: read.lastUpdated,
  };
}

export async function suggestFdaTerm(query: string): Promise<string | null> {
  const term = query.trim().toLowerCase();
  if (!/^[a-z]{4,}$/.test(term)) return null;
  try {
    const response = await readFda(`product_description:${term}~1`, 5, 0, null);
    if (response.status !== 200 || !Array.isArray(response.payload?.results)) return null;
    const descriptions = response.payload.results
      .map((row) => (row && typeof row === "object" && !Array.isArray(row) ? plain((row as { product_description?: unknown }).product_description) : null))
      .filter((row): row is string => Boolean(row));
    return suggestToken(term, descriptions);
  } catch {
    return null;
  }
}

export async function fdaByNumber(recallNumber: string): Promise<{ state: "ok" | "empty" | "error"; records: FdaRecord[]; lastUpdated: string | null; failure: SourceFailure | null; detail: string | null }> {
  try {
    const response = await readFda(`recall_number:"${recallNumber}"`, 5, 0, null);
    const read = interpretFdaPayload(response.status, response.payload);
    if (read.outcome === "unavailable" || read.outcome === "unreadable") {
      return { state: "error", records: [], lastUpdated: null, failure: read.outcome, detail: failureDetail("fda", read.outcome) };
    }
    if (read.outcome === "empty") return { state: "empty", records: [], lastUpdated: read.lastUpdated, failure: null, detail: null };
    return { state: "ok", records: read.records, lastUpdated: read.lastUpdated, failure: null, detail: null };
  } catch (error) {
    const failure = failureKind(error);
    return { state: "error", records: [], lastUpdated: null, failure, detail: failureDetail("fda", failure) };
  }
}

export async function fdaByEvent(eventId: string, currentNumbers: string[]): Promise<{ state: "ok" | "empty" | "error"; records: FdaRecord[]; failure: SourceFailure | null; detail: string | null }> {
  try {
    const response = await readFda(`event_id:"${eventId}"`, 25, 0, null);
    const read = interpretFdaPayload(response.status, response.payload);
    if (read.outcome === "unavailable" || read.outcome === "unreadable") {
      return { state: "error", records: [], failure: read.outcome, detail: failureDetail("fda", read.outcome) };
    }
    const skip = new Set(currentNumbers);
    const records = (read.outcome === "rows" ? read.records : []).filter((row) => row.recallNumber && !skip.has(row.recallNumber));
    return { state: records.length ? "ok" : "empty", records, failure: null, detail: null };
  } catch (error) {
    const failure = failureKind(error);
    return { state: "error", records: [], failure, detail: failureDetail("fda", failure) };
  }
}
