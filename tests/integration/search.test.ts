import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/search/route";
import { FDA_ENFORCEMENT, FDA_NOTICES, FSIS_ENDPOINT, FSIS_USER_AGENT, NO_MATCH } from "@/lib/copy";
import { interpretFsisCatalog } from "@/lib/fsis";
import { interpretRss } from "@/lib/notices";
import { interpretFdaPayload } from "@/lib/openfda";
import { searchRecalls } from "@/lib/search";
import type { SearchInput } from "@/lib/types";

const milk: SearchInput = {
  q: "milk",
  page: 1,
  status: "all",
  class: "all",
  separateWords: false,
  from: null,
  to: null,
};

describe("live FDA and USDA search", () => {
  it("returns real FDA milk enforcement rows", async () => {
    const report = await searchRecalls(milk);
    expect(report.fda.state).toBe("ok");
    expect(report.fda.total).toBeGreaterThan(0);
    expect(report.fda.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const row = report.fda.records[0];
    expect(row?.recallNumber).toMatch(/^[A-Z]{1,3}-\d{3,5}-\d{4}$/);
    expect(row?.productDescription || row?.firm).toBeTruthy();
    expect(row?.productType).toBe("Food");
    expect(report.message).toBeNull();
    expect(JSON.stringify(row)).not.toMatch(/Dangerous/);
  });

  it("uses the required sentence when nothing matches", async () => {
    const report = await searchRecalls({ ...milk, q: "zzzznotarealfood999" });
    expect(report.message).toBe(NO_MATCH);
    expect(report.fda.state).toBe("empty");
    expect(report.fda.records).toEqual([]);
    expect(report.notices.records).toEqual([]);
  });

  it("returns real USDA chicken recalls", async () => {
    const report = await searchRecalls({ ...milk, q: "chicken" });
    expect(report.fsis.state).toBe("ok");
    expect(report.fsis.recallTotal + report.fsis.alertTotal).toBeGreaterThan(0);
    const row = report.fsis.records[0] ?? report.fsis.alerts[0];
    expect(row?.recallNumber).toBeTruthy();
    expect(row?.title || row?.products).toBeTruthy();
    if (row?.url) expect(row.url).toMatch(/^https:\/\/www\.fsis\.usda\.gov\//);
    expect(JSON.stringify(row)).not.toMatch(/Dangerous/);
  });

  it("serves a live cheese search from the route", async () => {
    const response = await GET(new NextRequest("http://127.0.0.1/api/search?q=cheese"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fda.total).toBeGreaterThan(0);
    expect(body.fda.records[0].recallNumber).toMatch(/^[A-Z]{1,3}-\d{3,5}-\d{4}$/);
    expect(body.message).toBeNull();
  });

  it("keeps a live FDA row readable after the payload gains an unknown field", async () => {
    const response = await fetch(`${FDA_ENFORCEMENT}?search=${encodeURIComponent('product_type:"Food"')}&limit=1`);
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      meta?: { results?: { total?: number }; last_updated?: string };
      results?: Array<Record<string, unknown>>;
    };
    const row = payload.results?.[0];
    expect(row).toBeTruthy();
    const read = interpretFdaPayload(200, {
      meta: { results: { total: String(payload.meta?.results?.total ?? "") }, last_updated: payload.meta?.last_updated },
      results: [
        { ...row, unexpected_schema_field: { nested: [1] }, status: { value: row?.status }, product_description: [row?.product_description] },
        "not-a-row",
        null,
      ],
    });
    expect(read.outcome).toBe("rows");
    if (read.outcome !== "rows") return;
    expect(read.records[0]?.recallNumber).toMatch(/^[A-Z]{1,3}-\d{3,5}-\d{4}$/);
    expect(read.records.every((record) => !("unexpected_schema_field" in record))).toBe(true);
    expect(JSON.stringify(read.records)).not.toMatch(/Dangerous/);
    expect(interpretFdaPayload(200, { results: { changed: true } }).outcome).toBe("unreadable");
  });

  it("keeps a live USDA row readable after the list shape changes", async () => {
    const response = await fetch(`${FSIS_ENDPOINT}?field_recall_number=026-2026`, {
      headers: {
        Accept: "application/json",
        "User-Agent": FSIS_USER_AGENT,
        Referer: "https://www.fsis.usda.gov/recalls",
      },
    });
    expect(response.status).toBe(200);
    const parsed = await response.json() as unknown;
    const rows = Array.isArray(parsed) ? parsed : (parsed as { results?: unknown[] }).results;
    expect(Array.isArray(rows) && rows.length > 0).toBe(true);
    const row = (rows as Record<string, unknown>[])[0];
    const read = interpretFsisCatalog(JSON.stringify([
      { ...row, brand_new_field: { hello: true }, field_title: { value: row.field_title } },
      { nope: true },
    ]));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.records[0]?.recallNumber).toBeTruthy();
    expect(JSON.stringify(read.records)).not.toMatch(/Dangerous/);
    expect(interpretFsisCatalog('{"unexpected":[]}')).toEqual({ ok: false });
  });

  it("rejects a notice body that is no longer the FDA feed", async () => {
    const response = await fetch(FDA_NOTICES);
    expect(response.status).toBe(200);
    const xml = await response.text();
    const notices = interpretRss(xml);
    expect(notices && notices.length).toBeGreaterThan(0);
    expect(notices?.every((notice) => notice.url.startsWith("https://www.fda.gov/"))).toBe(true);
    expect(interpretRss('{"items":[{"title":"Nope"}]}')).toBeNull();
  });
});
