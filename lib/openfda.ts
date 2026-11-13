import { FDA_ENFORCEMENT, FDA_UNCHECKED, PAGE_SIZE } from "@/lib/copy";
import { fetchUpstream } from "@/lib/http";
import { buildFdaQuery, pageWindow } from "@/lib/query";
import type { FdaRecord, FdaSection, RecentReport, SearchInput } from "@/lib/types";
import { calendarDate, clean, fdaGroup, suggestToken } from "@/lib/text";

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
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const status = clean(row.status);
  return {
    source: "fda",
    recallNumber: clean(row.recall_number),
    eventId: clean(row.event_id),
    status,
    classification: clean(row.classification),
    group: fdaGroup(status),
    productDescription: clean(row.product_description),
    reason: clean(row.reason_for_recall),
    firm: clean(row.recalling_firm),
    address1: clean(row.address_1),
    address2: clean(row.address_2),
    city: clean(row.city),
    state: clean(row.state),
    postalCode: clean(row.postal_code),
    country: clean(row.country),
    distribution: clean(row.distribution_pattern),
    quantity: clean(row.product_quantity),
    codeInfo: clean(row.code_info),
    moreCodeInfo: clean(row.more_code_info),
    initiationDate: calendarDate(row.recall_initiation_date),
    classificationDate: calendarDate(row.center_classification_date),
    reportDate: calendarDate(row.report_date),
    terminationDate: calendarDate(row.termination_date),
    voluntaryMandated: clean(row.voluntary_mandated),
    notification: clean(row.initial_firm_notification),
    productType: clean(row.product_type),
  };
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
    const count = (item as { count?: unknown }).count;
    if (typeof count !== "number") continue;
    if (term === "Ongoing") ongoing = count;
    if (term === "Completed" || term === "Terminated") {
      historical += count;
      sawHistorical = true;
    }
  }
  return { ongoing, historical: sawHistorical ? historical : null };
}

export async function searchFda(input: SearchInput): Promise<FdaSection> {
  const window = pageWindow(input.fdaPage ?? input.page);
  if (window.error) {
    return {
      state: "error",
      detail: window.error,
      lastUpdated: null,
      total: 0,
      ongoingTotal: null,
      historicalTotal: null,
      records: [],
      truncated: false,
    };
  }
  const search = buildFdaQuery(input);
  try {
    const [page, count] = await Promise.all([
      readFda(search, PAGE_SIZE, window.skip, null),
      input.status === "all" ? readFda(search, PAGE_SIZE, 0, "status.exact") : Promise.resolve(null),
    ]);
    if (page.status === 404) {
      return {
        state: "empty",
        detail: "The FDA enforcement catalog returned no rows for this search.",
        lastUpdated: calendarDate(page.payload?.meta?.last_updated) ?? clean(page.payload?.meta?.last_updated),
        total: 0,
        ongoingTotal: 0,
        historicalTotal: 0,
        records: [],
        truncated: false,
      };
    }
    if (page.status !== 200 || !page.payload) {
      return {
        state: "error",
        detail: FDA_UNCHECKED,
        lastUpdated: null,
        total: 0,
        ongoingTotal: null,
        historicalTotal: null,
        records: [],
        truncated: false,
      };
    }
    const rawRows = Array.isArray(page.payload.results) ? page.payload.results : [];
    const records = rawRows.map(normalizeFda).filter((row): row is FdaRecord => Boolean(row));
    const unread = rawRows.length - records.length;
    const total = page.payload.meta?.results?.total ?? records.length;
    const split = count ? totals(count.payload) : { ongoing: null, historical: null };
    const detail = unread > 0 ? `${unread} rows on this page could not be read and were left out.` : "FDA food enforcement records.";
    return {
      state: records.length ? "ok" : "empty",
      detail,
      lastUpdated: calendarDate(page.payload.meta?.last_updated) ?? clean(page.payload.meta?.last_updated),
      total,
      ongoingTotal: split.ongoing,
      historicalTotal: split.historical,
      records,
      truncated: total > 25_000,
    };
  } catch {
    return {
      state: "error",
      detail: FDA_UNCHECKED,
      lastUpdated: null,
      total: 0,
      ongoingTotal: null,
      historicalTotal: null,
      records: [],
      truncated: false,
    };
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
      return { state: "error", detail: FDA_UNCHECKED, lastUpdated: null, ongoing: [], historical: [] };
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
      detail,
      lastUpdated: ongoing.lastUpdated ?? historical.lastUpdated,
      ongoing: ongoingRecords,
      historical: historicalRecords,
    };
  } catch {
    return { state: "error", detail: FDA_UNCHECKED, lastUpdated: null, ongoing: [], historical: [] };
  }
}

function rowsFromFda(status: number, payload: FdaPayload | null): { ok: boolean; records: FdaRecord[]; lastUpdated: string | null } {
  if (status === 404) return { ok: true, records: [], lastUpdated: null };
  if (status !== 200 || !payload) return { ok: false, records: [], lastUpdated: null };
  return {
    ok: true,
    records: (payload.results ?? []).map(normalizeFda).filter((row): row is FdaRecord => Boolean(row)),
    lastUpdated: calendarDate(payload.meta?.last_updated) ?? clean(payload.meta?.last_updated),
  };
}

export async function suggestFdaTerm(query: string): Promise<string | null> {
  const term = query.trim().toLowerCase();
  if (!/^[a-z]{4,}$/.test(term)) return null;
  try {
    const response = await readFda(`product_description:${term}~1`, 5, 0, null);
    if (response.status !== 200 || !Array.isArray(response.payload?.results)) return null;
    const descriptions = response.payload.results
      .map((row) => (row && typeof row === "object" ? clean((row as { product_description?: unknown }).product_description) : null))
      .filter((row): row is string => Boolean(row));
    return suggestToken(term, descriptions);
  } catch {
    return null;
  }
}

export async function fdaByNumber(recallNumber: string): Promise<{ state: "ok" | "empty" | "error"; records: FdaRecord[]; lastUpdated: string | null }> {
  try {
    const response = await readFda(`recall_number:"${recallNumber}"`, 5, 0, null);
    if (response.status === 404) return { state: "empty", records: [], lastUpdated: null };
    if (response.status !== 200 || !response.payload) return { state: "error", records: [], lastUpdated: null };
    const records = (response.payload.results ?? []).map(normalizeFda).filter((row): row is FdaRecord => Boolean(row));
    return {
      state: records.length ? "ok" : "empty",
      records,
      lastUpdated: calendarDate(response.payload.meta?.last_updated) ?? clean(response.payload.meta?.last_updated),
    };
  } catch {
    return { state: "error", records: [], lastUpdated: null };
  }
}

export async function fdaByEvent(eventId: string, currentNumbers: string[]): Promise<{ state: "ok" | "empty" | "error"; records: FdaRecord[] }> {
  try {
    const response = await readFda(`event_id:"${eventId}"`, 25, 0, null);
    if (response.status === 404) return { state: "empty", records: [] };
    if (response.status !== 200 || !response.payload) return { state: "error", records: [] };
    const skip = new Set(currentNumbers);
    const records = (response.payload.results ?? [])
      .map(normalizeFda)
      .filter((row): row is FdaRecord => Boolean(row && row.recallNumber && !skip.has(row.recallNumber)));
    return { state: records.length ? "ok" : "empty", records };
  } catch {
    return { state: "error", records: [] };
  }
}
