import { NextResponse } from "next/server";
import { assertFixturesAllowed } from "@/lib/boot";
import { searchRecalls } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertFixturesAllowed();
    const report = await searchRecalls({
      q: "milk",
      page: 1,
      status: "all",
      class: "all",
      separateWords: false,
      from: null,
      to: null,
    });
    const ready = report.fda.state === "ok" && report.fda.records.some((record) => record.recallNumber);
    return NextResponse.json(
      { ok: ready, fda: report.fda.state, fsis: report.fsis.state, notices: report.notices.state, lastUpdated: report.fda.lastUpdated },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
