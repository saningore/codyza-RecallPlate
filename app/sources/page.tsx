import type { Metadata } from "next";
import { CDC_OUTBREAKS, ENFORCEMENT_ABOUT, FDA_NOTICES, FDA_OUTBREAKS, FOODSAFETY_GOV, FSIS_ENDPOINT, FSIS_HOME, OPENFDA_ABOUT } from "@/lib/copy";

export const metadata: Metadata = { title: "Sources" };

const SOURCES = [
  {
    name: "openFDA food enforcement",
    href: OPENFDA_ABOUT,
    use: "The search asks https://api.fda.gov/food/enforcement.json for food recall rows from 2004 onward. A page is 20 rows, sorted by report date. The extract date on the page is meta.last_updated from that response.",
    limit: "openFDA updates this dataset weekly. Its own documentation says not to use it to issue public alerts or to track whether a recall is still open. Status on a row is the status in that extract. A zero-hit query comes back as HTTP 404 and is shown as no matching records.",
  },
  {
    name: "FDA food safety recalls feed",
    href: FDA_NOTICES,
    use: "Recently posted notices come from FDA’s food safety recalls RSS feed. Each item keeps the title, link, date, and description FDA published.",
    limit: "A notice can appear before the weekly enforcement extract includes it. The feed does not include every enforcement row. RecallPlate does not assign a class to a notice.",
  },
  {
    name: "FDA Enforcement Reports",
    href: ENFORCEMENT_ABOUT,
    use: "A recall number links to the FDA Enforcement Report page for that product number, and to the openFDA query that returns the same number.",
    limit: "The enforcement report is the classified catalog. Press notices and enforcement rows are different publications.",
  },
  {
    name: "USDA FSIS Recall API",
    href: FSIS_ENDPOINT,
    use: "Meat, poultry, and processed egg products come from the FSIS recall API. RecallPlate downloads that public list and filters it. Public health alerts stay in their own group. Active and closed stay in the words FSIS sent.",
    limit: "If FSIS cannot be reached, the page says USDA was not checked and does not add a recall in its place. A list already retrieved can be reused for 15 minutes. Distribution is the state list FSIS returned. It is not drawn as a map.",
  },
  {
    name: "Outbreak pages",
    href: FDA_OUTBREAKS,
    use: "Illness investigations are published separately by FDA and CDC. FoodSafety.gov is the combined consumer entry point for FDA and USDA.",
    limit: "RecallPlate does not attach case counts to a recall. A keyword overlap is not treated as a link between an outbreak and a product.",
  },
];

export default function SourcesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">Where the information comes from</h1>
      <p className="mt-4 text-lg">The browser talks only to this site. FDA requests use the User-Agent RecallPlate/1.0 (https://codyza.com). The FSIS edge network rejects that name, even when it is added to a browser user agent, so USDA requests use a normal browser user agent and ask for JSON. An openFDA response may be reused on the server for 10 minutes. An FSIS response may be reused for 15 minutes. The page shows the extract date or the retrieval time.</p>
      <div className="mt-8 space-y-6">
        {SOURCES.map((source) => (
          <section key={source.name} className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-serif text-2xl font-semibold">
              <a className="underline decoration-sea/40 underline-offset-4" href={source.href}>{source.name}</a>
            </h2>
            <p className="mt-3">{source.use}</p>
            <p className="mt-3 text-ink/80">{source.limit}</p>
          </section>
        ))}
      </div>
      <ul className="mt-8 space-y-2">
        <li><a className="font-bold text-sea underline" href={FSIS_HOME}>FSIS recalls and public health alerts</a></li>
        <li><a className="font-bold text-sea underline" href={CDC_OUTBREAKS}>CDC foodborne outbreaks</a></li>
        <li><a className="font-bold text-sea underline" href={FOODSAFETY_GOV}>FoodSafety.gov recalls and outbreaks</a></li>
      </ul>
    </article>
  );
}
