const USER_AGENT = "RecallPlate/1.0 (https://codyza.com)";

async function read(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const milk = await read("https://api.fda.gov/food/enforcement.json?search=product_description:milk&limit=1");
const row = milk.body?.results?.[0];
if (milk.status !== 200 || !row?.recall_number || !milk.body?.meta?.last_updated) {
  throw new Error("openFDA did not return a milk recall.");
}
console.log(`FDA milk recall ${row.recall_number}; extract ${milk.body.meta.last_updated}.`);

try {
  const fsis = await fetch("https://www.fsis.usda.gov/fsis/api/recall/v/1?field_recall_number=026-2026", {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: "https://www.fsis.usda.gov/recalls",
    },
    signal: AbortSignal.timeout(20_000),
  });
  console.log(fsis.ok ? "USDA FSIS responded." : `USDA FSIS could not be checked (HTTP ${fsis.status}).`);
} catch {
  console.log("USDA FSIS could not be checked.");
}
