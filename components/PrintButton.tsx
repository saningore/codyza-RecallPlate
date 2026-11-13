"use client";

export default function PrintButton() {
  return (
    <button className="no-print min-h-11 rounded-full border border-line px-4 font-bold" type="button" onClick={() => window.print()}>
      Print this record
    </button>
  );
}
