import Link from "next/link";
import StatusMark from "@/components/StatusMark";
import type { FdaRecord, FsisRecord } from "@/lib/types";
import { classDefinition, displayStatus, enforcementReportUrl, show, shownDate } from "@/lib/text";

export function FdaCard({ record, query }: { record: FdaRecord; query: string }) {
  const href = record.recallNumber
    ? `/recalls/fda/${encodeURIComponent(record.recallNumber)}${query ? `?q=${encodeURIComponent(query)}` : ""}`
    : "";
  return (
    <article data-source="fda" data-status={record.group} className="min-w-0 rounded-3xl border border-line bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">FDA enforcement</p>
      <StatusMark group={record.group} label={displayStatus(record.status, "fda")} />
      <h3 className="mt-2 break-words font-serif text-2xl font-semibold">{record.productDescription ?? "Product description was not included"}</h3>
      <p className="mt-2 font-bold">{record.classification ?? "Class not included"}</p>
      {classDefinition(record.classification) ? <p className="mt-1 text-sm text-ink/80">{classDefinition(record.classification)}</p> : null}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt className="text-sm font-bold">Recalling firm</dt><dd className="break-words">{show(record.firm)}</dd></div>
        <div><dt className="text-sm font-bold">Recall number</dt><dd>{show(record.recallNumber)}</dd></div>
        <div><dt className="text-sm font-bold">Initiation date</dt><dd>{shownDate(record.initiationDate)}</dd></div>
        <div><dt className="text-sm font-bold">Report date</dt><dd>{shownDate(record.reportDate)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm font-bold">Distribution</dt><dd className="break-words">{show(record.distribution)}</dd></div>
      </dl>
      <p className="mt-3 line-clamp-4 break-words">{show(record.reason)}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {href ? <Link className="inline-flex min-h-11 items-center font-bold text-sea underline" href={href} aria-label={`Full FDA record for ${record.recallNumber ?? record.productDescription ?? "this product"}`}>Full record</Link> : null}
        {record.recallNumber ? <a className="inline-flex min-h-11 items-center font-bold text-sea underline" href={enforcementReportUrl(record.recallNumber)} target="_blank" rel="noopener noreferrer" aria-label={`FDA Enforcement Report for ${record.recallNumber}, opens in a new tab`}>FDA Enforcement Report</a> : null}
      </div>
    </article>
  );
}

export function FsisCard({ record, query }: { record: FsisRecord; query: string }) {
  const href = record.recallNumber
    ? `/recalls/fsis/${encodeURIComponent(record.recallNumber)}${query ? `?q=${encodeURIComponent(query)}` : ""}`
    : "";
  return (
    <article data-source="fsis" data-status={record.group} className="min-w-0 rounded-3xl border border-line bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">USDA FSIS</p>
      <StatusMark group={record.group} label={displayStatus(record.recallType, "fsis")} />
      <h3 className="mt-2 break-words font-serif text-2xl font-semibold">{record.title ?? record.products ?? "Title was not included"}</h3>
      <p className="mt-2 font-bold">{record.riskLevel ?? record.classification ?? "Class not included"}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt className="text-sm font-bold">Establishment</dt><dd className="break-words">{show(record.establishment)}</dd></div>
        <div><dt className="text-sm font-bold">Recall number</dt><dd>{show(record.recallNumber)}</dd></div>
        <div><dt className="text-sm font-bold">Recall date</dt><dd>{shownDate(record.date)}</dd></div>
        <div><dt className="text-sm font-bold">Distribution</dt><dd className="break-words">{show(record.states)}</dd></div>
      </dl>
      {record.products ? <p className="mt-3 line-clamp-3 break-words">{record.products}</p> : null}
      <p className="mt-3 line-clamp-4 break-words">{show(record.reason)}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {href ? <Link className="inline-flex min-h-11 items-center font-bold text-sea underline" href={href} aria-label={`Full USDA record for ${record.recallNumber ?? record.title ?? "this product"}`}>Full record</Link> : null}
        {record.url ? <a className="inline-flex min-h-11 items-center font-bold text-sea underline" href={record.url} target="_blank" rel="noopener noreferrer" aria-label={`FSIS notice for ${record.recallNumber ?? "this record"}, opens in a new tab`}>FSIS notice</a> : null}
      </div>
    </article>
  );
}
