import { NextRequest, NextResponse } from "next/server";
import { assertFixturesAllowed } from "@/lib/boot";
import { clientKey, rateLimit } from "@/lib/http";
import { loadRecent } from "@/lib/recent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertFixturesAllowed();
  } catch {
    return NextResponse.json({ error: "Fixture mode is refused." }, { status: 500 });
  }
  if (!rateLimit(`recent:${clientKey(request.headers.get("x-forwarded-for"))}`, 30)) {
    return NextResponse.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }
  try {
    const body = await loadRecent();
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Recently published records could not be loaded." }, { status: 500 });
  }
}
