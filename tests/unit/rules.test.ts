import { describe, expect, it } from "vitest";
import { assertFixturesAllowed } from "@/lib/boot";
import { FIXTURE_REFUSAL, NO_MATCH } from "@/lib/copy";
import { fdaFacts } from "@/lib/facts";
import { completeJsonObjects, normalizeFsis } from "@/lib/fsis";
import { rateLimit } from "@/lib/http";
import { fdaNoticeUrl, parseRss } from "@/lib/notices";
import { normalizeFda } from "@/lib/openfda";
import { buildFdaQuery, pageWindow, parseRecallNumber, parseSearchParams } from "@/lib/query";
import { classDefinition, displayStatus, fdaGroup, formatCalendarDate, fsisGroup, fsisUrl, plain, resultMessage, suggestToken } from "@/lib/text";

const base = {
  status: "all" as const,
  class: "all" as const,
  separateWords: false,
  from: null,
  to: null,
};

describe("recall query builder", () => {
  it("searches a phrase across the official text fields", () => {
    expect(buildFdaQuery({ q: "peanut butter", ...base })).toBe(
      '(product_description:"peanut butter" OR recalling_firm:"peanut butter" OR reason_for_recall:"peanut butter" OR code_info:"peanut butter" OR distribution_pattern:"peanut butter")',
    );
  });

  it("keeps an injected operator inside the phrase", () => {
    expect(buildFdaQuery({ q: 'milk" OR status:"Ongoing', ...base })).toContain('product_description:"milk OR status Ongoing"');
  });

  it("uses the recall number field for an FDA number", () => {
    expect(buildFdaQuery({ q: "h-0178-2027", ...base })).toBe('recall_number:"H-0178-2027"');
  });

  it("requires every word when the person asks to split the phrase", () => {
    const query = buildFdaQuery({ q: "peanut butter", ...base, separateWords: true });
    expect(query).toContain('product_description:"peanut"');
    expect(query).toContain(' AND ');
    expect(query).toContain('product_description:"butter"');
  });

  it("stops paging past the openFDA skip limit", () => {
    expect(pageWindow(1).skip).toBe(0);
    expect(pageWindow(1252).error).toMatch(/25,000/);
  });

  it("rejects an empty search before a request would be sent", () => {
    const parsed = parseSearchParams(new URLSearchParams("q=%20"));
    expect(parsed.ok).toBe(false);
  });

  it("pages one catalog without moving the others", () => {
    const parsed = parseSearchParams(new URLSearchParams("q=milk&page=2&fdaPage=3"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.fdaPage).toBe(3);
    expect(parsed.value.fsisPage).toBe(2);
    expect(parsed.value.noticePage).toBe(2);
  });

  it("recognizes an FSIS public health alert number", () => {
    expect(parseRecallNumber("pha-10062026-01")).toEqual({ kind: "fsis", number: "PHA-10062026-01" });
  });
});

describe("official records", () => {
  it("keeps an empty FDA field empty and does not relabel Class II", () => {
    const record = normalizeFda({
      status: "Ongoing",
      classification: "Class II",
      recall_number: "H-0178-2027",
      product_description: "Plant milk butter",
      reason_for_recall: "Product recalled due to yeast, mold, and E. coli.",
      recalling_firm: "Prosperity Organic Foods Inc",
      address_2: "",
      more_code_info: "   ",
      recall_initiation_date: "20260911",
      report_date: "20261104",
    });
    expect(record?.classification).toBe("Class II");
    expect(record?.address2).toBeNull();
    expect(record?.moreCodeInfo).toBeNull();
    expect(record?.initiationDate).toBe("2026-09-11");
    expect(formatCalendarDate(record?.initiationDate ?? null)).toBe("September 11, 2026");
    expect(displayStatus(record?.status ?? null, "fda")).toBe("Current enforcement status: Ongoing");
    expect(displayStatus("Terminated", "fda")).toBe("Historical enforcement status: Terminated");
    expect(classDefinition("Class II")).toMatch(/remote/);
    expect(JSON.stringify(fdaFacts(record!))).not.toMatch(/Dangerous/);
    expect(fdaGroup("Ongoing")).toBe("ongoing");
  });

  it("keeps a USDA public health alert out of the recall groups", () => {
    const record = normalizeFsis({
      field_title: "Public health alert",
      field_recall_type: "Public Health Alert",
      field_risk_level: "Public Health Alert",
      field_recall_number: "PHA-2026",
      field_states: ["Nationwide"],
      field_establishment: ["Example Foods"],
    });
    expect(record?.group).toBe("alert");
    const notice = normalizeFsis({
      field_recall_type: "Active Recall",
      field_recall_number: "026-2026",
      field_summary: "<p>Do not eat&nbsp;this lot.</p>",
      field_recall_url: "http://www.fsis.usda.gov/recalls-alerts/example",
    });
    expect(notice?.summary).toBe("Do not eat this lot.");
    expect(plain("&quot;BEEF&quot; &amp; SPICY")).toBe('"BEEF" & SPICY');
    expect(notice?.url).toBe("https://www.fsis.usda.gov/recalls-alerts/example");
    expect(fsisUrl("https://example.com/recall")).toBeNull();
    expect(completeJsonObjects('[{"field_title":"One"},{"field_title":"Tw')).toEqual([{ field_title: "One" }]);
    expect(fsisGroup("Active Recall")).toBe("active");
    expect(fsisGroup("Closed Recall")).toBe("closed");
    expect(displayStatus(record?.recallType ?? null, "fsis")).toBe("USDA public health alert");
  });

  it("reads an FDA notice and drops a link that leaves fda.gov", () => {
    const notices = parseRss(`
      <item>
        <title>Example Cheddar Recall</title>
        <link>http://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example-cheddar</link>
        <description>Cheddar because of Listeria</description>
        <pubDate>Tue, 10 Nov 2026 22:00:00 EST</pubDate>
      </item>
      <item>
        <title>Elsewhere</title>
        <link>https://example.com/recall</link>
        <description>Cheese</description>
      </item>
    `);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.url).toBe("https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example-cheddar");
    expect(notices[0]?.published).toBe("2026-11-10");
    expect(fdaNoticeUrl("https://example.com/recall")).toBeNull();
  });
});

describe("empty and failed searches", () => {
  it("uses the required sentence only when a completed source has no rows", () => {
    expect(resultMessage({ fda: "empty", fsis: "empty", notices: "empty" })).toBe(NO_MATCH);
    expect(resultMessage({ fda: "empty", fsis: "error", notices: "empty" })).toBe(NO_MATCH);
    expect(resultMessage({ fda: "ok", fsis: "empty", notices: "empty" })).toBeNull();
    expect(resultMessage({ fda: "error", fsis: "error", notices: "error" })).toBeNull();
  });

  it("suggests a one-letter correction from official description text", () => {
    expect(suggestToken("mlik", ["Grade A milk, gallon"])).toBe("milk");
    expect(suggestToken("milk", ["Grade A milk"])).toBeNull();
  });
});

describe("runtime guards", () => {
  it("refuses fixture mode", () => {
    process.env.RECALLPLATE_USE_FIXTURES = "1";
    try {
      expect(() => assertFixturesAllowed()).toThrow(FIXTURE_REFUSAL);
    } finally {
      delete process.env.RECALLPLATE_USE_FIXTURES;
    }
  });

  it("stops a client after the request limit", () => {
    const key = `unit-${Date.now()}`;
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });
});
