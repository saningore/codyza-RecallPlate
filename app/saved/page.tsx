"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetQuery, readSaved, type SavedQuery } from "@/lib/browser-store";

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  useEffect(() => {
    setSaved(readSaved());
  }, []);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">Saved searches</h1>
      <p className="mt-3">These queries stay in this browser. Opening one runs a new search of the current FDA and USDA records.</p>
      {saved.length === 0 ? <p className="mt-6">No searches are saved in this browser.</p> : null}
      <ul className="mt-6 space-y-3">
        {saved.map((item) => (
          <li key={item.query} className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-card p-4">
            <Link className="min-h-11 font-bold text-sea underline" href={`/?q=${encodeURIComponent(item.query)}`}>{item.query}</Link>
            <button className="min-h-11 rounded-full border border-line px-4 font-bold" type="button" onClick={() => setSaved(forgetQuery(item.query))}>Remove</button>
          </li>
        ))}
      </ul>
    </article>
  );
}
