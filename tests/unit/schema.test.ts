import { describe, expect, it } from "vitest";
import { FDA_TIMEOUT, FDA_UNREADABLE, FSIS_UNCHECKED, failureDetail, failureTitle } from "@/lib/copy";
import { interpretFsisCatalog, normalizeFsis } from "@/lib/fsis";
import { interpretRss } from "@/lib/notices";
import { interpretFdaPayload, normalizeFda } from "@/lib/openfda";
import { failureKind, searchAnnouncement } from "@/lib/text";

const fdaRow = {
  status: "Ongoing",
  classification: "Class II",
  recall_number: "H-0178-2027",
  product_description: "Plant milk butter",
  reason_for_recall: "Yeast and mold.",
  recalling_firm: "Prosperity Organic Foods Inc",
  report_date: "20261104",
  unexpected_schema_field: { nested: true },
};

describe("FDA payloads with an unexpected shape", () => {
  it("keeps a readable row and drops fields it does not know", () => {
    const record = normalizeFda({
      ...fdaRow,
      status: 1,
      product_description: ["Plant milk", "butter"],
      postal_code: 83702,
      distribution_pattern: { value: "Nationwide" },
    });
    expect(record?.status).toBeNull();
    expect(record?.productDescription).toBe("Plant milk, butter");
    expect(record?.postalCode).toBe("83702");
    expect(record?.distribution).toBe("Nationwide");
    expect(record?.recallNumber).toBe("H-0178-2027");
    expect(record && "unexpected_schema_field" in record).toBe(false);
    expect(JSON.stringify(record)).not.toMatch(/Dangerous/);
  });

  it("treats a replaced results list as unreadable instead of an empty search", () => {
    expect(interpretFdaPayload(200, { results: { rows: [] } }).outcome).toBe("unreadable");
    expect(interpretFdaPayload(200, [{ ...fdaRow }]).outcome).toBe("unreadable");
    expect(interpretFdaPayload(200, null).outcome).toBe("unreadable");
    expect(interpretFdaPayload(500, { results: [] }).outcome).toBe("unavailable");
    expect(interpretFdaPayload(404, { error: { code: "NOT_FOUND" } }).outcome).toBe("empty");
  });

  it("reads a numeric total and skips rows that have no identity", () => {
    const read = interpretFdaPayload(200, {
      meta: { results: { total: "4829" }, last_updated: "20261104" },
      results: [fdaRow, "not-a-row", null, { classification: "Class I" }, { recall_number: 12 }],
    });
    expect(read.outcome).toBe("rows");
    if (read.outcome !== "rows") return;
    expect(read.total).toBe(4829);
    expect(read.records).toHaveLength(1);
    expect(read.dropped).toBe(4);
    expect(read.lastUpdated).toBe("2026-11-04");
    expect(read.records[0]?.firm).toBe("Prosperity Organic Foods Inc");
  });

  it("does not invent rows when every result is unreadable", () => {
    const read = interpretFdaPayload(200, { results: [{ classification: { changed: true } }, 4] });
    expect(read.outcome).toBe("unreadable");
  });
});

describe("USDA payloads with an unexpected shape", () => {
  it("reads a wrapped list and ignores an unknown field", () => {
    const read = interpretFsisCatalog(JSON.stringify({
      results: [
        {
          field_recall_number: "026-2026",
          field_title: { value: "Chicken wraps" },
          field_recall_type: "Active Recall",
          field_summary: "<p>Do not eat&nbsp;this lot.</p>",
          field_recall_url: "http://www.fsis.usda.gov/recalls-alerts/example",
          brand_new_field: { hello: true },
        },
        { nope: true },
      ],
    }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.records).toHaveLength(1);
    expect(read.records[0]?.title).toBe("Chicken wraps");
    expect(read.records[0]?.summary).toBe("Do not eat this lot.");
    expect(read.records[0]?.url).toBe("https://www.fsis.usda.gov/recalls-alerts/example");
    expect(JSON.stringify(read.records)).not.toMatch(/Dangerous/);
  });

  it("rejects a catalog that no longer has a known list", () => {
    expect(interpretFsisCatalog('{"unexpected":[]}')).toEqual({ ok: false });
    expect(interpretFsisCatalog("<html>blocked</html>")).toEqual({ ok: false });
    expect(interpretFsisCatalog("[]")).toEqual({ ok: true, records: [] });
  });

  it("still normalizes a label list that arrives as one object", () => {
    const record = normalizeFsis({
      field_recall_number: "026-2026",
      field_title: "Beef stew",
      field_labels: { url: "https://www.fsis.usda.gov/sites/default/files/example.pdf" },
    });
    expect(record?.labels).toEqual(["https://www.fsis.usda.gov/sites/default/files/example.pdf"]);
  });
});

describe("FDA notice feeds with an unexpected shape", () => {
  it("rejects JSON and Atom when the RSS items are gone", () => {
    expect(interpretRss('{"items":[{"title":"Nope"}]}')).toBeNull();
    expect(interpretRss("<feed><entry><title>Atom notice</title></entry></feed>")).toBeNull();
    expect(interpretRss("<rss><channel></channel></rss>")).toEqual([]);
  });

  it("rejects an item that no longer has a link", () => {
    expect(interpretRss("<rss><channel><item><title>Cheddar</title></item></channel></rss>")).toBeNull();
  });

  it("keeps a readable notice when an extra tag appears", () => {
    const notices = interpretRss(`
      <rss>
        <channel>
          <item>
            <title>Example Cheddar Recall</title>
            <link>https://www.fda.gov/safety/example-cheddar</link>
            <extra>ignore me</extra>
            <description>Cheddar because of Listeria</description>
            <pubDate>Tue, 10 Nov 2026 22:00:00 EST</pubDate>
          </item>
        </channel>
      </rss>
    `);
    expect(notices).toHaveLength(1);
    expect(notices?.[0]?.title).toBe("Example Cheddar Recall");
    expect(notices?.[0]?.published).toBe("2026-11-10");
  });
});

describe("failure copy", () => {
  it("names a timeout without turning it into an empty result", () => {
    expect(failureKind(new Error("timeout"))).toBe("timeout");
    expect(failureKind(new Error("network"))).toBe("unavailable");
    expect(failureDetail("fda", "timeout")).toBe(FDA_TIMEOUT);
    expect(failureDetail("fda", "unreadable")).toBe(FDA_UNREADABLE);
    expect(failureTitle("fsis", "unavailable")).toBe("USDA FSIS could not be checked");
    expect(failureDetail("fsis", "unavailable")).toBe(FSIS_UNCHECKED);
    const announcement = searchAnnouncement({
      query: "chicken",
      message: null,
      fda: { state: "ok", detail: "FDA food enforcement records.", total: 3 },
      fsis: { state: "error", detail: FSIS_UNCHECKED, recallTotal: 0 },
      notices: { state: "empty", detail: "The FDA notice feed had no matching item." },
    });
    expect(announcement).toContain("3 FDA enforcement records");
    expect(announcement).toContain(FSIS_UNCHECKED);
    expect(announcement).not.toContain("No matching recall records were found.");
  });
});
