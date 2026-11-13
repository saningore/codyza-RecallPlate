import { USER_AGENT } from "@/lib/copy";

const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clientKey(header: string | null): string {
  const forwarded = header?.split(",")[0]?.trim();
  return forwarded || "local";
}

export async function fetchUpstream(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<{ status: number; bodyText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": USER_AGENT,
        ...headers,
      },
    });
    const bodyText = await response.text();
    return { status: response.status, bodyText };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("timeout");
    }
    throw new Error("network");
  } finally {
    clearTimeout(timer);
  }
}
