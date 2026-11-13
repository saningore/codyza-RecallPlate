"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RecentRecords from "@/components/RecentRecords";
import ResultSections from "@/components/ResultSections";
import { readLast, readSaved, readSession, rememberQuery, writeLast, writeSession, type SavedQuery } from "@/lib/browser-store";
import { ENTER_QUERY, NO_MATCH, OFFLINE_COPY } from "@/lib/copy";
import type { ClassFilter, SearchReport, StatusFilter } from "@/lib/types";

const EXAMPLES = ["milk", "peanut butter", "chicken", "cheese"];

export default function SearchExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const searchKey = params.toString();
  const inputId = useId();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) || "all");
  const [klass, setKlass] = useState<ClassFilter>((params.get("class") as ClassFilter) || "all");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [report, setReport] = useState<SearchReport | null>(null);
  const [phase, setPhase] = useState<"idle" | "searching">("idle");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSaved(readSaved());
  }, []);

  useEffect(() => {
    const current = new URLSearchParams(searchKey);
    const nextQuery = current.get("q") ?? "";
    setQuery(nextQuery);
    setStatus((current.get("status") as StatusFilter) || "all");
    setKlass((current.get("class") as ClassFilter) || "all");
    setFrom(current.get("from") ?? "");
    setTo(current.get("to") ?? "");
    if (!nextQuery.trim()) {
      setReport(null);
      setPhase("idle");
      setOffline(false);
      return;
    }
    const controller = new AbortController();
    setPhase("searching");
    setError("");
    setOffline(false);
    const recent = readSession(searchKey);
    if (recent) {
      setReport(recent);
      setPhase("idle");
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/search?${searchKey}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as SearchReport & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Recall records could not be loaded. Try again in a few minutes.");
        setReport(payload);
        writeSession(searchKey, payload);
        writeLast(searchKey, payload);
      } catch (caught) {
        if (controller.signal.aborted) return;
        const savedReport = readLast(searchKey);
        if (savedReport) {
          setReport(savedReport);
          setOffline(true);
          setError("");
        } else {
          setReport(null);
          setError(caught instanceof Error ? caught.message : "Recall records could not be loaded. Try again in a few minutes.");
        }
      } finally {
        if (!controller.signal.aborted) setPhase("idle");
      }
    })();
    return () => controller.abort();
  }, [searchKey]);

  function go(next: URLSearchParams) {
    const value = next.get("q")?.trim() ?? "";
    if (!value) {
      setError(ENTER_QUERY);
      setReport(null);
      return;
    }
    setError("");
    router.push(next.toString() ? `/?${next.toString()}` : "/");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    next.set("q", query.trim());
    next.set("status", status);
    next.set("class", klass);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    next.set("page", "1");
    go(next);
  }

  function searchTerm(value: string, words = false) {
    const next = new URLSearchParams();
    next.set("q", value);
    next.set("status", status);
    next.set("class", klass);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (words) next.set("words", "1");
    next.set("page", "1");
    go(next);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Search published U.S. food recalls.</h1>
      <p className="mt-3 max-w-3xl text-lg">FDA publishes most foods. USDA publishes meat, poultry, and processed egg products. RecallPlate repeats the records those agencies return.</p>
      <form className="mt-6 rounded-3xl border border-line bg-card p-4" onSubmit={onSubmit} aria-busy={phase === "searching"}>
        <label className="block font-bold" htmlFor={inputId}>Food, product, or company</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-line bg-paper px-4"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="milk, peanut butter, a company, or a recall number"
            aria-describedby={`${inputId}-hint`}
          />
          <button className="min-h-11 rounded-full bg-pine px-5 font-bold text-card disabled:opacity-60" type="submit" disabled={phase === "searching"}>Search records</button>
        </div>
        <p id={`${inputId}-hint`} className="mt-2 max-w-3xl text-sm text-ink/80">Search a food, a company, a package code, or a recall number. Distribution text is searched too. No matching records does not mean a product is safe.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button key={example} className="min-h-11 rounded-full border border-line px-4 font-bold" type="button" onClick={() => searchTerm(example)}>Search {example}</button>
          ))}
        </div>
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer font-bold">Filters</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-bold">Status
              <select className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                <option value="all">All statuses</option>
                <option value="ongoing">Ongoing or active</option>
                <option value="historical">Completed, terminated, or closed</option>
              </select>
            </label>
            <label className="block text-sm font-bold">Class
              <select className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3" value={klass} onChange={(event) => setKlass(event.target.value as ClassFilter)}>
                <option value="all">All classes</option>
                <option value="I">Class I</option>
                <option value="II">Class II</option>
                <option value="III">Class III</option>
                <option value="unclassified">Not yet classified</option>
              </select>
            </label>
            <label className="block text-sm font-bold">From
              <input className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="block text-sm font-bold">To
              <input className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-paper px-3" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
        </details>
      </form>
      {phase === "searching" ? (
        <div className="mt-4">
          <p role="status">Checking FDA and USDA records.</p>
          <div className="mt-3 space-y-3" aria-hidden="true">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-2xl bg-amber px-4 py-3" role="alert">{error}</p> : null}
      {offline && report ? <p className="mt-4 rounded-2xl bg-wheat px-4 py-3" role="status">{OFFLINE_COPY} Retrieved {report.retrievedAt}.</p> : null}
      {report?.message ? (
        <div className="mt-4 rounded-2xl bg-moss px-4 py-3" role="status">
          <p>{report.message}</p>
          {report.fda.state === "error" ? <p className="mt-2">{report.fda.detail}</p> : null}
          {report.fsis.state === "error" ? <p className="mt-2">USDA FSIS could not be checked. This is not a complete search.</p> : null}
          {report.notices.state === "error" ? <p className="mt-2">{report.notices.detail}</p> : null}
        </div>
      ) : null}
      {report?.suggestion ? (
        <p className="mt-4">
          <button className="min-h-11 rounded-full border border-line bg-card px-4 font-bold" type="button" onClick={() => searchTerm(report.suggestion ?? "")}>Search {report.suggestion}</button>
        </p>
      ) : null}
      {report && !report.separateWords && report.message === NO_MATCH && query.trim().split(/\s+/).length > 1 ? (
        <p className="mt-4">
          <button className="min-h-11 rounded-full border border-line bg-card px-4 font-bold" type="button" onClick={() => searchTerm(query.trim(), true)}>Search these words separately</button>
        </p>
      ) : null}
      {report && phase === "idle" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="min-h-11 rounded-full border border-line bg-card px-4 font-bold"
            type="button"
            onClick={() => setSaved(rememberQuery(report.query))}
          >
            Save this search
          </button>
          <button
            className="min-h-11 rounded-full border border-line bg-card px-4 font-bold"
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href).then(() => {
                setCopied(true);
              }).catch(() => setCopied(false));
            }}
          >
            {copied ? "Link copied" : "Copy link to this search"}
          </button>
        </div>
      ) : null}
      {saved.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {saved.map((item) => (
            <li key={item.query}>
              <button className="min-h-11 rounded-full bg-moss px-4 font-bold" type="button" onClick={() => searchTerm(item.query)}>{item.query}</button>
            </li>
          ))}
        </ul>
      ) : null}
      {report ? <ResultSections report={report} search={searchKey} /> : null}
      {!(params.get("q") ?? "").trim() ? <RecentRecords /> : null}
    </div>
  );
}
