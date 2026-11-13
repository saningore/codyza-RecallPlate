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
});
