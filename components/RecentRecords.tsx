"use client";

import { useEffect, useState } from "react";
import { FdaCard, FsisCard } from "@/components/RecallCards";
import { PHA_NOTE, RECENT_NOTE } from "@/lib/copy";
import type { FdaRecord, FsisRecord, RecentReport } from "@/lib/types";
import { formatCalendarDate, formatTimestamp } from "@/lib/text";

export default function RecentRecords() {
  const [report, setReport] = useState<RecentReport | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/recent", { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as RecentReport & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Recently published records could not be loaded.");
        setReport(payload);
        setPhase("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Recently published records could not be loaded.");
        setPhase("error");
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <section className="mt-12" aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="font-serif text-3xl font-semibold">Recently published records</h2>
      <p className="mt-2 max-w-3xl">{RECENT_NOTE}</p>
      {phase === "loading" ? (
        <div className="mt-4">
          <p role="status">Loading recently published FDA and USDA records.</p>
          <div className="mt-3 space-y-3" aria-hidden="true">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
      ) : null}
      {phase === "error" ? <p className="mt-4 rounded-2xl bg-amber px-4 py-3" role="alert">{error}</p> : null}
      {report ? (
        <div className="mt-6 space-y-8">
          <p className="text-sm">Retrieved {formatTimestamp(report.retrievedAt)}.{report.fda.lastUpdated ? ` FDA extract ${formatCalendarDate(report.fda.lastUpdated)}.` : ""}</p>
          {report.fda.state === "error" ? <p className="rounded-2xl bg-amber px-4 py-3" role="alert">{report.fda.detail}</p> : null}
          {report.fda.state === "empty" ? <p>{report.fda.detail}</p> : null}
          {report.fda.state === "ok" && report.fda.detail.startsWith("Part of") ? <p>{report.fda.detail}</p> : null}
          <RecordBlock title="Ongoing FDA enforcement records" source="fda" records={report.fda.ongoing} />
          <RecordBlock title="Historical FDA enforcement records" source="fda" records={report.fda.historical} />
          {report.fsis.state === "error" ? <p className="rounded-2xl bg-amber px-4 py-3" role="alert">{report.fsis.detail}</p> : null}
          {report.fsis.state === "ok" ? <p>{report.fsis.detail}</p> : null}
          <RecordBlock title="USDA active recalls" source="fsis" records={report.fsis.active} />
          <RecordBlock title="USDA closed recalls" source="fsis" records={report.fsis.closed} />
          {report.fsis.alerts.length ? (
            <div>
              <h3 className="font-serif text-2xl font-semibold">USDA public health alerts</h3>
              <p className="mt-2">{PHA_NOTE}</p>
              <div className="mt-3 space-y-4">
                {report.fsis.alerts.map((record, index) => <FsisCard key={`${record.recallNumber ?? "alert"}-${index}`} record={record} query="" />)}
              </div>
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
      <div className="mt-3 space-y-4">
        {records.map((record, index) => source === "fda"
          ? <FdaCard key={`${record.recallNumber ?? "fda"}-${index}`} record={record as FdaRecord} query="" />
          : <FsisCard key={`${record.recallNumber ?? "fsis"}-${index}`} record={record as FsisRecord} query="" />)}
      </div>
    </div>
  );
}
