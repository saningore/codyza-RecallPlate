import Link from "next/link";
import { FdaCard, FsisCard } from "@/components/RecallCards";
import {
  EXTRACT_NOTE,
  FDA_EMPTY,
  FDA_UNCHECKED,
  FSIS_EMPTY,
  FSIS_UNCHECKED,
  NOTICE_EMPTY,
  NOTICE_UNCHECKED,
  PARTIAL_SOURCE,
  PHA_NOTE,
  WORD_MATCH,
} from "@/lib/copy";
import type { Notice, SearchReport } from "@/lib/types";
import { formatCalendarDate, formatTimestamp } from "@/lib/text";

export default function ResultSections({ report, search }: { report: SearchReport; search: string }) {
  const query = report.query;
  const states = [report.fda.state, report.fsis.state, report.notices.state];
  const partial = states.some((state) => state === "error") && states.some((state) => state === "ok");
  return (
    <div className="mt-8 space-y-10">
      {report.separateWords ? <p className="rounded-2xl bg-wheat px-4 py-3 font-bold">{WORD_MATCH}</p> : null}
      <p className="text-lg">Records for “{query}”. Ongoing and active records are grouped apart from completed, terminated, and closed records.</p>
      <ul className="flex flex-wrap gap-2 text-sm">
        <li className="status-mark status-ongoing">Ongoing or active</li>
        <li className="status-mark status-historical">Historical</li>
        <li className="status-mark status-alert">Public health alert</li>
      </ul>
      {partial ? <p className="rounded-2xl bg-amber px-4 py-3" role="status">{PARTIAL_SOURCE}</p> : null}
      <nav className="flex flex-wrap gap-3 text-sm font-bold" aria-label="Result sections">
        <a className="underline" href="#fda-heading">FDA enforcement</a>
        <a className="underline" href="#fsis-heading">USDA FSIS</a>
        <a className="underline" href="#notice-heading">FDA notices</a>
      </nav>
      <SourceStrip report={report} />
      <FdaSection report={report} query={query} search={search} />
      <FsisSection report={report} query={query} search={search} />
      <NoticeSection report={report} search={search} />
    </div>
  );
}

function SourceStrip({ report }: { report: SearchReport }) {
  return (
    <dl className="grid gap-3 rounded-3xl border border-line bg-card p-4 sm:grid-cols-3">
      <div>
        <dt className="text-sm font-bold">FDA enforcement extract</dt>
        <dd>{report.fda.lastUpdated ? formatCalendarDate(report.fda.lastUpdated) : report.fda.state === "error" ? "Not checked" : "Date not included"}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold">USDA FSIS</dt>
        <dd>{report.fsis.retrievedAt ? formatTimestamp(report.fsis.retrievedAt) : "Not checked"}</dd>
      </div>
      <div>
        <dt className="text-sm font-bold">FDA notices</dt>
        <dd>{report.notices.retrievedAt ? formatTimestamp(report.notices.retrievedAt) : "Not checked"}</dd>
      </div>
    </dl>
  );
}

function FdaSection({ report, query, search }: { report: SearchReport; query: string; search: string }) {
  const { fda } = report;
  const ongoing = fda.records.filter((record) => record.group === "ongoing");
  const historical = fda.records.filter((record) => record.group === "historical");
  const other = fda.records.filter((record) => record.group === "other");
  return (
    <section aria-labelledby="fda-heading">
      <h2 id="fda-heading" className="font-serif text-3xl font-semibold">FDA enforcement records</h2>
      <p className="mt-2 max-w-3xl">{EXTRACT_NOTE}</p>
      {fda.lastUpdated ? <p className="mt-2">Extract last updated {formatCalendarDate(fda.lastUpdated)}.</p> : null}
      {fda.state === "ok" ? (
        <p className="mt-2">
          {fda.total.toLocaleString("en-US")} matching FDA enforcement records.
          {fda.ongoingTotal != null && fda.historicalTotal != null
            ? ` In the extract: ${fda.ongoingTotal.toLocaleString("en-US")} Ongoing, ${fda.historicalTotal.toLocaleString("en-US")} Completed or Terminated.`
            : ""}
        </p>
      ) : null}
      {fda.state === "error" ? <p className="mt-3 rounded-2xl bg-amber px-4 py-3" role="alert">{FDA_UNCHECKED}</p> : null}
      {fda.state === "empty" && !report.message ? <p className="mt-3">{FDA_EMPTY}</p> : null}
      {fda.truncated ? <p className="mt-2">openFDA will not return results past 25,000 matching records. Narrow the search.</p> : null}
      <RecordGroup title="Ongoing in this extract" records={ongoing} query={query} />
      <RecordGroup title="Other status in this extract" records={other} query={query} />
      <RecordGroup title="Historical enforcement records" records={historical} query={query} />
      <Pager page={report.fdaPage ?? report.page} pageSize={report.pageSize} total={fda.total} label="FDA pages" search={search} pageKey="fdaPage" />
    </section>
  );
}

function RecordGroup({ title, records, query }: { title: string; records: SearchReport["fda"]["records"]; query: string }) {
  if (!records.length) return null;
  return (
    <div className="mt-6">
      <h3 className="font-serif text-2xl font-semibold">{title}</h3>
      <div className="mt-3 space-y-4">
        {records.map((record, index) => <FdaCard key={`${record.recallNumber ?? "row"}-${index}`} record={record} query={query} />)}
      </div>
    </div>
  );
}

function FsisSection({ report, query, search }: { report: SearchReport; query: string; search: string }) {
  const { fsis } = report;
  const active = fsis.records.filter((record) => record.group === "active");
  const closed = fsis.records.filter((record) => record.group === "closed");
  const other = fsis.records.filter((record) => record.group === "other");
  return (
    <section aria-labelledby="fsis-heading">
      <h2 id="fsis-heading" className="font-serif text-3xl font-semibold">USDA FSIS records</h2>
      <p className="mt-2 max-w-3xl">Meat, poultry, and processed egg products are published by USDA FSIS. These rows use FSIS words for status and class.</p>
      {fsis.state === "error" ? <p className="mt-3 rounded-2xl bg-amber px-4 py-3" role="alert">{FSIS_UNCHECKED}</p> : null}
      {fsis.state === "empty" && !report.message ? <p className="mt-3">{FSIS_EMPTY}</p> : null}
      {fsis.state === "ok" ? <p className="mt-2">{fsis.recallTotal.toLocaleString("en-US")} matching USDA recalls. {fsis.alertTotal.toLocaleString("en-US")} matching public health alerts.</p> : null}
      <FsisGroup title="USDA active recalls" records={active} query={query} />
      <FsisGroup title="USDA records without a recall type" records={other} query={query} />
      <FsisGroup title="USDA closed recalls" records={closed} query={query} />
      {fsis.alerts.length ? (
        <div className="mt-6">
          <h3 className="font-serif text-2xl font-semibold">USDA public health alerts</h3>
          <p className="mt-2">{PHA_NOTE}</p>
          <div className="mt-3 space-y-4">
            {fsis.alerts.map((record, index) => <FsisCard key={`${record.recallNumber ?? "alert"}-${index}`} record={record} query={query} />)}
          </div>
        </div>
      ) : null}
      <Pager page={report.fsisPage ?? report.page} pageSize={report.pageSize} total={Math.max(fsis.recallTotal, fsis.alertTotal)} label="USDA pages" search={search} pageKey="fsisPage" />
    </section>
  );
}

function FsisGroup({ title, records, query }: { title: string; records: SearchReport["fsis"]["records"]; query: string }) {
  if (!records.length) return null;
  return (
    <div className="mt-6">
      <h3 className="font-serif text-2xl font-semibold">{title}</h3>
      <div className="mt-3 space-y-4">
        {records.map((record, index) => <FsisCard key={`${record.recallNumber ?? "row"}-${index}`} record={record} query={query} />)}
      </div>
    </div>
  );
}

function NoticeSection({ report, search }: { report: SearchReport; search: string }) {
  const { notices } = report;
  return (
    <section aria-labelledby="notice-heading">
      <h2 id="notice-heading" className="font-serif text-3xl font-semibold">Recently posted FDA notices</h2>
      <p className="mt-2 max-w-3xl">These are items from FDA’s food safety recalls feed. A notice can be newer than the enforcement extract. This page does not assign a recall class unless the notice text includes one.</p>
      {notices.state === "error" ? <p className="mt-3 rounded-2xl bg-amber px-4 py-3" role="alert">{NOTICE_UNCHECKED}</p> : null}
      {notices.state === "empty" && !report.message ? <p className="mt-3">{NOTICE_EMPTY}</p> : null}
      {notices.state === "ok" ? <p className="mt-2">{notices.total.toLocaleString("en-US")} matching FDA notices.</p> : null}
      <div className="mt-4 space-y-4">
        {notices.records.map((notice) => <NoticeCard key={notice.url} notice={notice} />)}
      </div>
      <Pager page={report.noticePage ?? report.page} pageSize={report.pageSize} total={notices.total} label="FDA notice pages" search={search} pageKey="noticePage" />
    </section>
  );
}

function NoticeCard({ notice }: { notice: Notice }) {
  return (
    <article data-source="notice" className="min-w-0 rounded-3xl border border-line bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-sea">FDA notice</p>
      <h3 className="mt-1 break-words font-serif text-2xl font-semibold">{notice.title}</h3>
      <p className="mt-2">Posted {formatCalendarDate(notice.published)}</p>
      {notice.summary ? <p className="mt-3 break-words">{notice.summary}</p> : null}
      <a className="mt-4 inline-flex min-h-11 items-center font-bold text-sea underline" href={notice.url} target="_blank" rel="noopener noreferrer">FDA notice</a>
    </article>
  );
}

function Pager({ page, pageSize, total, label, search, pageKey }: { page: number; pageSize: number; total: number; label: string; search: string; pageKey: "fdaPage" | "fsisPage" | "noticePage" }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const previous = page > 1 ? page - 1 : null;
  const next = page < pages && (page * pageSize) <= 25_000 ? page + 1 : null;
  return (
    <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label={label}>
      {previous ? <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 font-bold" href={pageHref(search, pageKey, previous)}>Previous</Link> : null}
      <p>Page {page} of {pages.toLocaleString("en-US")}</p>
      {next ? <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 font-bold" href={pageHref(search, pageKey, next)}>Next</Link> : null}
    </nav>
  );
}

function pageHref(search: string, key: "fdaPage" | "fsisPage" | "noticePage", page: number): string {
  const params = new URLSearchParams(search);
  const shared = params.get("page") || "1";
  if (!params.get("fdaPage")) params.set("fdaPage", shared);
  if (!params.get("fsisPage")) params.set("fsisPage", shared);
  if (!params.get("noticePage")) params.set("noticePage", shared);
  params.set(key, String(page));
  return `/?${params.toString()}`;
}
