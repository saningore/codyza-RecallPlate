import { expect, test } from "@playwright/test";

test.describe("RecallPlate in the browser", () => {
  test("keeps the footer, rejects an empty search, and explains the sources", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Search published U.S. food recalls." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toHaveAttribute("href", "https://codyza.com");

    await page.getByLabel("Food, product, or company").fill("   ");
    await page.getByRole("button", { name: "Search records", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a food, product, or company name." })).toBeVisible();
    await expect(page.getByText("No matching recall records were found.")).toHaveCount(0);

    await page.getByRole("link", { name: "Sources" }).click();
    await expect(page.getByRole("heading", { name: "Where the information comes from" })).toBeVisible();
    await expect(page.getByRole("link", { name: "openFDA food enforcement" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();

    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByRole("heading", { name: "About RecallPlate" })).toBeVisible();
    await expect(page.getByText("An empty search result is not a finding that a food is safe.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
  });

  test("shows the required sentence when no record matches", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Food, product, or company").fill("zzzznotarealfood999");
    await page.getByRole("button", { name: "Search records", exact: true }).click();
    await expect(page.getByText("Checking FDA and USDA records.")).toBeVisible();
    await expect(page.getByText("No matching recall records were found.")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("article[data-source='fda']")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
  });

  test("opens a real milk recall from the FDA catalog", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await page.getByLabel("Food, product, or company").fill("milk");
    await page.getByRole("button", { name: "Search records", exact: true }).click();
    await expect(page.getByRole("heading", { name: "FDA enforcement records" })).toBeVisible({ timeout: 90_000 });
    const card = page.locator("article[data-source='fda']").first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/Class I|Class II|Class III|Not Yet Classified|Class not included/)).toBeVisible();
    await card.getByRole("link", { name: "Full record" }).click();
    await expect(page).toHaveURL(/\/recalls\/fda\//);
    await expect(page.getByRole("link", { name: "openFDA record for this recall number" })).toBeVisible();
    await expect(page.getByRole("link", { name: "FDA Enforcement Report for this recall number" })).toBeVisible();
    await expect(page.getByText("Not included in this record").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
  });

  test("shows a missing page without dropping the footer", async ({ page }) => {
    await page.goto("/recalls/fda/not-a-number");
    await expect(page.getByRole("heading", { name: "That recall link is not valid" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
    await page.goto("/missing-page");
    await expect(page.getByRole("heading", { name: "That page is not available" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
  });

  test("keeps the search usable on a phone-width screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Codyza" })).toBeVisible();
    await page.getByLabel("Food, product, or company").fill("zzzznotarealfood999");
    await page.getByRole("button", { name: "Search records", exact: true }).click();
    await expect(page.getByText("No matching recall records were found.")).toBeVisible({ timeout: 90_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("moves from the search box through filters and results with the keyboard", async ({ page }) => {
    await page.route("**/api/search**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sampleReport()),
    }));
    await page.goto("/");
    const input = page.getByRole("search", { name: "Search food recalls" }).getByLabel("Food, product, or company");
    await input.focus();
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "Enter a food, product, or company name." })).toBeVisible();

    await page.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("From date")).toBeVisible();
    await page.getByLabel("Status").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Class")).toBeFocused();

    await input.focus();
    await page.keyboard.type("milk");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=milk/);
    await expect(page.locator("#search-results")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Save this search" })).toBeFocused();
    const full = page.getByRole("link", { name: "Full FDA record for H-0178-2027" });
    await full.focus();
    await expect(full).toBeFocused();
    await expect(full).toHaveAttribute("href", /\/recalls\/fda\/H-0178-2027/);
    await expect(page.getByRole("link", { name: "Next FDA page" })).toBeVisible();
    await expect(page.locator("article[data-source='fsis']")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: "USDA FSIS did not respond in time" })).toBeVisible();
  });

  test("shows a retry when the search request fails and recovers on the next try", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/search**", (route) => {
      calls += 1;
      if (calls === 1) return route.abort();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sampleReport()),
      });
    });
    await page.goto("/?q=milk&status=all&class=all&page=1");
    await expect(page.getByRole("heading", { name: "This search could not be finished" })).toBeVisible();
    await expect(page.getByText("Nothing was added to fill this gap. A failed check is not a finding that a food is safe.")).toBeVisible();
    await expect(page.locator("article[data-source='fda']")).toHaveCount(0);
    await page.getByRole("button", { name: "Try this search again" }).click();
    await expect(page.getByRole("heading", { name: "FDA enforcement records" })).toBeVisible();
    await expect(page.getByText("Not included in this record").first()).toBeVisible();
  });
});

function sampleReport() {
  return {
    query: "milk",
    page: 1,
    pageSize: 20,
    separateWords: false,
    fdaPage: 1,
    fsisPage: 1,
    noticePage: 1,
    suggestion: null,
    message: null,
    retrievedAt: "2026-11-13T21:00:00.000Z",
    fda: {
      state: "ok",
      failure: null,
      detail: "FDA food enforcement records.",
      lastUpdated: "2026-11-04",
      total: 25,
      ongoingTotal: 1,
      historicalTotal: 0,
      truncated: false,
      records: [{
        source: "fda",
        recallNumber: "H-0178-2027",
        eventId: null,
        status: "Ongoing",
        classification: "Class II",
        group: "ongoing",
        productDescription: "Plant milk butter",
        reason: "Yeast and mold.",
        firm: "Prosperity Organic Foods Inc",
        address1: null,
        address2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        distribution: null,
        quantity: null,
        codeInfo: null,
        moreCodeInfo: null,
        initiationDate: "2026-09-11",
        classificationDate: null,
        reportDate: "2026-11-04",
        terminationDate: null,
        voluntaryMandated: null,
        notification: null,
        productType: "Food",
      }],
    },
    fsis: {
      state: "error",
      failure: "timeout",
      detail: "USDA FSIS did not respond in time. No USDA recall was added in its place.",
      retrievedAt: null,
      recallTotal: 0,
      alertTotal: 0,
      records: [],
      alerts: [],
    },
    notices: {
      state: "empty",
      failure: null,
      detail: "The FDA notice feed had no matching item.",
      retrievedAt: "2026-11-13T21:00:00.000Z",
      total: 0,
      records: [],
    },
  };
}
