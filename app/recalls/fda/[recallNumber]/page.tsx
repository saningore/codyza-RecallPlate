import type { Metadata } from "next";
import Link from "next/link";
import FactList from "@/components/FactList";
import PrintButton from "@/components/PrintButton";
import SourceFallback from "@/components/SourceFallback";
import StatusMark from "@/components/StatusMark";
import { COMPARE_NOTE, ENFORCEMENT_ABOUT, EXTRACT_NOTE, OPENFDA_ABOUT, failureDetail, failureTitle } from "@/lib/copy";
import { fdaFacts } from "@/lib/facts";
import { fdaByEvent, fdaByNumber } from "@/lib/openfda";
import { isFdaNumber } from "@/lib/query";
import { classDefinition, displayStatus, enforcementReportUrl, formatCalendarDate, formatTimestamp } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "FDA recall record" };

export default async function FdaRecallPage({
  params,
  searchParams,
}: {
  params: Promise<{ recallNumber: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { recallNumber: raw } = await params;
  const { q } = await searchParams;
  const recallNumber = decodeURIComponent(raw).toUpperCase();
  const back = q ? `/?q=${encodeURIComponent(q)}` : "/";
  if (!isFdaNumber(recallNumber)) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl font-semibold">That recall link is not valid</h1>
        <p className="mt-3">The address does not match an FDA recall number.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center font-bold text-sea underline" href={back}>Back to search</Link>
      </article>
    );
  }
  const found = await fdaByNumber(recallNumber);
  const retrievedAt = new Date().toISOString();
  if (found.state === "error") {
    const failure = found.failure ?? "unavailable";
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <SourceFallback heading="h1" title={failureTitle("fda", failure)} detail={found.detail ?? failureDetail("fda", failure)} />
        <Link className="mt-6 inline-flex min-h-11 items-center font-bold text-sea underline" href={back}>Back to search</Link>
      </article>
    );
  }
  if (found.state === "empty") {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl font-semibold">This recall number was not returned</h1>
        <p className="mt-3">The FDA enforcement catalog did not return {recallNumber}.</p>
        <a className="mt-4 inline-flex min-h-11 items-center font-bold text-sea underline" href={enforcementReportUrl(recallNumber)}>FDA Enforcement Report for this recall number</a>
        <Link className="mt-6 inline-flex font-bold text-sea underline" href={back}>Back to search</Link>
      </article>
    );
  }
  const eventId = found.records.find((record) => record.eventId)?.eventId ?? null;
  const siblings = eventId
    ? await fdaByEvent(eventId, found.records.flatMap((record) => record.recallNumber ? [record.recallNumber] : []))
    : { state: "empty" as const, records: [], failure: null, detail: null };
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">FDA enforcement record</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{found.records[0]?.productDescription ?? "Product description was not included in this record"}</h1>
      {found.records[0] ? <div className="mt-3"><StatusMark group={found.records[0].group} label={displayStatus(found.records[0].status, "fda")} /></div> : null}
      <p className="mt-3">{EXTRACT_NOTE}</p>
      <p className="mt-3">{COMPARE_NOTE}</p>
      <div className="mt-4"><PrintButton /></div>
      {found.lastUpdated ? <p className="mt-2">Extract last updated {formatCalendarDate(found.lastUpdated)}.</p> : null}
      <p className="mt-2">Retrieved {formatTimestamp(retrievedAt)}.</p>
      {found.records.map((record) => (
        <section key={record.recallNumber ?? record.productDescription} className="mt-8">
          <h2 className="font-serif text-2xl font-semibold">{record.recallNumber ?? "Recall number was not included"}</h2>
          {record.classification ? <p className={record.classification === "Class I" ? "mt-2 font-bold text-clay" : "mt-2 font-bold"}>{record.classification}</p> : null}
          {classDefinition(record.classification) ? <p className="mt-2 text-sm">{classDefinition(record.classification)}</p> : null}
          <FactList facts={fdaFacts(record)} />
        </section>
      ))}
      <div className="mt-8 flex flex-col gap-3">
        <a className="font-bold text-sea underline" href={enforcementReportUrl(recallNumber)}>FDA Enforcement Report for this recall number</a>
        <a className="font-bold text-sea underline" href={OPENFDA_ABOUT}>openFDA food enforcement documentation</a>
        <a className="font-bold text-sea underline" href={ENFORCEMENT_ABOUT}>FDA Enforcement Reports</a>
      </div>
      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Other products in this FDA event</h2>
        {siblings.state === "error" ? <div className="mt-3"><SourceFallback heading="h3" title={failureTitle("fda", siblings.failure ?? "unavailable")} detail={siblings.detail ?? failureDetail("fda", siblings.failure ?? "unavailable")} /></div> : null}
        {siblings.state === "empty" ? <p className="mt-2">No other product row was returned for this event.</p> : null}
        <ul className="mt-3 space-y-2">
          {siblings.records.map((record) => record.recallNumber ? (
            <li key={record.recallNumber}>
              <Link className="font-bold text-sea underline" href={`/recalls/fda/${encodeURIComponent(record.recallNumber)}`}>{record.recallNumber}</Link>
              <span> — {record.productDescription ?? "Product description was not included"}</span>
            </li>
          ) : null)}
        </ul>
      </section>
      <Link className="mt-8 inline-flex min-h-11 items-center font-bold text-sea underline" href={back}>Back to search</Link>
    </article>
  );
}
