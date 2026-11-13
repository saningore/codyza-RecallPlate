"use client";

import { useEffect, useState } from "react";
import { FdaCard, FsisCard } from "@/components/RecallCards";
import SourceFallback from "@/components/SourceFallback";
import { PHA_NOTE, RECENT_NOTE, SEARCH_FAILED, failureTitle } from "@/lib/copy";
import type { FdaRecord, FsisRecord, RecentReport } from "@/lib/types";
import { formatCalendarDate, formatTimestamp } from "@/lib/text";

export default function RecentRecords() {
  const [report, setReport] = useState<RecentReport | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/recent", { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as RecentReport & { error?: string };
        if (!response.ok) throw new Error(payload.error || SEARCH_FAILED);
        setReport(payload);
        setPhase("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error && !/failed to fetch|unexpected token/i.test(caught.message) ? caught.message : SEARCH_FAILED);
        setPhase("error");
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="mt-12" aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="font-serif text-3xl font-semibold">Recently published records</h2>
      <p className="mt-2 max-w-3xl">{RECENT_NOTE}</p>
      {phase === "loading" ? (
        <div className="mt-4" role="status" aria-live="polite">
          <p>Loading recently published FDA and USDA records.</p>
          <div className="mt-3 space-y-3" aria-hidden="true">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
      ) : null}
      {phase === "error" ? (
        <div className="mt-4">
          <SourceFallback title="Recently published records could not be loaded" detail={error}>
            <button className="min-h-11 rounded-full bg-pine px-5 font-bold text-card" type="button" onClick={() => setAttempt((current) => current + 1)}>Try again</button>
          </SourceFallback>
        </div>
      ) : null}
      {report ? (
        <div className="mt-6 space-y-8">
          <p className="text-sm">Retrieved {formatTimestamp(report.retrievedAt)}.{report.fda.lastUpdated ? ` FDA extract ${formatCalendarDate(report.fda.lastUpdated)}.` : ""}</p>
          {report.fda.state === "error" ? <SourceFallback heading="h3" polite title={failureTitle("fda", report.fda.failure ?? "unavailable")} detail={report.fda.detail} /> : null}
          {report.fda.state === "empty" ? <p>{report.fda.detail}</p> : null}
          {report.fda.state === "ok" && report.fda.detail.startsWith("Part of") ? <p>{report.fda.detail}</p> : null}
          <RecordBlock title="Ongoing FDA enforcement records" source="fda" records={report.fda.ongoing} />
          <RecordBlock title="Historical FDA enforcement records" source="fda" records={report.fda.historical} />
          {report.fsis.state === "error" ? <SourceFallback heading="h3" polite title={failureTitle("fsis", report.fsis.failure ?? "unavailable")} detail={report.fsis.detail} /> : null}
          {report.fsis.state === "ok" ? <p>{report.fsis.detail}</p> : null}
          <RecordBlock title="USDA active recalls" source="fsis" records={report.fsis.active} />
          <RecordBlock title="USDA closed recalls" source="fsis" records={report.fsis.closed} />
          {report.fsis.alerts.length ? (
            <div>
              <h3 className="font-serif text-2xl font-semibold">USDA public health alerts</h3>
              <p className="mt-2">{PHA_NOTE}</p>
              <ul className="mt-3 space-y-4" aria-label="USDA public health alerts">
                {report.fsis.alerts.map((record, index) => <li key={`${record.recallNumber ?? "alert"}-${index}`}><FsisCard record={record} query="" /></li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RecordBlock({ title, source, records }: { title: string; source: "fda" | "fsis"; records: Array<FdaRecord | FsisRecord> }) {
  if (!records.length) return null;
  return (
    <div>
      <h3 className="font-serif text-2xl font-semibold">{title}</h3>
      <ul className="mt-3 space-y-4" aria-label={title}>
        {records.map((record, index) => <li key={`${record.recallNumber ?? source}-${index}`}>{source === "fda"
          ? <FdaCard record={record as FdaRecord} query="" />
          : <FsisCard record={record as FsisRecord} query="" />}</li>)}
      </ul>
    </div>
  );
}
