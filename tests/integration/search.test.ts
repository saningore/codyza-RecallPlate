import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/search/route";
import { NO_MATCH } from "@/lib/copy";
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
});
