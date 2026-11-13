import type { Metadata } from "next";
import { CLASS_DEFINITIONS } from "@/lib/copy";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">About RecallPlate</h1>
      <p className="mt-4 text-lg">RecallPlate searches published U.S. food recall records. It repeats the product text, the reason, the dates, and the class the agency sent.</p>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Two catalogs</h2>
        <p className="mt-2">FDA’s enforcement extract covers most foods, including dietary supplements and foods FDA posted as Food. USDA FSIS covers meat, poultry, and processed egg products. A chicken search can match both, and each row is labeled with the agency that published it.</p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Current and historical</h2>
        <p className="mt-2">FDA rows are grouped by the status in the weekly extract: Ongoing, or Completed and Terminated. USDA rows are grouped as active recalls, closed recalls, or public health alerts. An old initiation date stays visible on an Ongoing row. The extract date is printed with the results.</p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">How to read a result</h2>
        <p className="mt-2">Open the full record and compare the product description, company, codes, dates, and distribution with the package in front of you. A similar name is not the same record. The page repeats the agency’s words. It does not decide that a package matches, and it does not call a product dangerous beyond the class and reason the agency published.</p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">What a class means</h2>
        <ul className="mt-3 space-y-3">
          {Object.entries(CLASS_DEFINITIONS).map(([name, text]) => (
            <li key={name}><span className="font-bold">{name}. </span>{text}</li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">What this site will not add</h2>
        <p className="mt-2">RecallPlate does not write a recall explanation, a safety score, or consumer instructions that are absent from the record. A brand is shown only when the source has a brand field. An empty search result is not a finding that a food is safe.</p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">What stays on this device</h2>
        <p className="mt-2">Saved searches stay in this browser, up to five queries. There is no account. Opening a saved search runs a new check.</p>
      </section>
    </article>
  );
}
