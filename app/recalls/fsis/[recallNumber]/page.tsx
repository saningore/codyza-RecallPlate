import type { Metadata } from "next";
import Link from "next/link";
import FactList from "@/components/FactList";
import PrintButton from "@/components/PrintButton";
import StatusMark from "@/components/StatusMark";
import { COMPARE_NOTE, FSIS_HOME, FSIS_UNCHECKED, PHA_NOTE } from "@/lib/copy";
import { fsisFacts } from "@/lib/facts";
import { fsisByNumber } from "@/lib/fsis";
import { isFsisNumber } from "@/lib/query";
import { displayStatus, formatTimestamp } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "USDA recall record" };

export default async function FsisRecallPage({
  params,
  searchParams,
}: {
  params: Promise<{ recallNumber: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { recallNumber: raw } = await params;
  const { q } = await searchParams;
  const recallNumber = decodeURIComponent(raw);
  const back = q ? `/?q=${encodeURIComponent(q)}` : "/";
  if (!isFsisNumber(recallNumber)) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl font-semibold">That recall link is not valid</h1>
        <p className="mt-3">The address does not match a USDA FSIS recall number.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center font-bold text-sea underline" href={back}>Back to search</Link>
      </article>
    );
  }
  const found = await fsisByNumber(recallNumber);
  if (found.state === "error") {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl font-semibold">USDA FSIS could not be checked</h1>
        <p className="mt-3">{FSIS_UNCHECKED}</p>
        <a className="mt-4 inline-flex font-bold text-sea underline" href={FSIS_HOME}>FSIS recalls and public health alerts</a>
        <Link className="mt-6 block font-bold text-sea underline" href={back}>Back to search</Link>
      </article>
    );
  }
  if (!found.record) {
    return (
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl font-semibold">This recall number was not returned</h1>
        <p className="mt-3">USDA FSIS did not return {recallNumber}.</p>
        <a className="mt-4 inline-flex font-bold text-sea underline" href={FSIS_HOME}>FSIS recalls and public health alerts</a>
      </article>
    );
  }
  const record = found.record;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">USDA FSIS record</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{record.title ?? record.products ?? "Title was not included in this record"}</h1>
      <div className="mt-3"><StatusMark group={record.group} label={displayStatus(record.recallType, "fsis")} /></div>
      {record.group === "alert" ? <p className="mt-3 rounded-2xl bg-wheat px-4 py-3">{PHA_NOTE}</p> : null}
      <p className="mt-3">{COMPARE_NOTE}</p>
      <div className="mt-4"><PrintButton /></div>
      <p className="mt-3 font-bold">{record.riskLevel ?? record.classification ?? "Class not included"}</p>
      <p className="mt-2">Retrieved {formatTimestamp(new Date().toISOString())}.</p>
      <FactList facts={fsisFacts(record)} />
      {record.labels.length ? (
        <div className="mt-6 flex flex-col gap-2">
          {record.labels.map((label) => (
            <a key={label} className="font-bold text-sea underline" href={label}>FSIS label file</a>
          ))}
        </div>
      ) : null}
      <div className="mt-8 flex flex-col gap-3">
        {record.url ? <a className="font-bold text-sea underline" href={record.url}>FSIS notice for this recall number</a> : <p>FSIS did not include a notice URL in this record.</p>}
        {record.retailList ? <a className="font-bold text-sea underline" href={record.retailList}>Retail distribution list</a> : null}
        <a className="font-bold text-sea underline" href={FSIS_HOME}>FSIS recalls and public health alerts</a>
      </div>
      <Link className="mt-8 inline-flex min-h-11 items-center font-bold text-sea underline" href={back}>Back to search</Link>
    </article>
  );
}
