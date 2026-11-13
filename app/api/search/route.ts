import { NextRequest, NextResponse } from "next/server";
import { assertFixturesAllowed } from "@/lib/boot";
import { clientKey, rateLimit } from "@/lib/http";
import { parseSearchParams } from "@/lib/query";
import { searchRecalls } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertFixturesAllowed();
  } catch {
    return NextResponse.json({ error: "Fixture mode is refused." }, { status: 500 });
  }
  if (!rateLimit(`search:${clientKey(request.headers.get("x-forwarded-for"))}`)) {
    return NextResponse.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }
  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const body = await searchRecalls(parsed.value);
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Recall records could not be loaded. Try again in a few minutes." }, { status: 500 });
  }
}
