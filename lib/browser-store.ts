import type { SearchReport } from "@/lib/types";

export type SavedQuery = { query: string; savedAt: string };

const SAVED = "recallplate.saved.v1";
const SESSION = "recallplate.session.v1";
const LAST = "recallplate.last.v1";

type Cached = { at: number; key: string; body: SearchReport };

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function readSaved(): SavedQuery[] {
  const parsed = readJson<SavedQuery[]>(SAVED);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => item && typeof item.query === "string").slice(0, 5);
}

export function rememberQuery(query: string): SavedQuery[] {
  const trimmed = query.trim();
  if (!trimmed) return readSaved();
  const next = [{ query: trimmed, savedAt: new Date().toISOString() }, ...readSaved().filter((item) => item.query.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
  window.localStorage.setItem(SAVED, JSON.stringify(next));
  return next;
}

export function forgetQuery(query: string): SavedQuery[] {
  const next = readSaved().filter((item) => item.query !== query);
  window.localStorage.setItem(SAVED, JSON.stringify(next));
  return next;
}

export function readSession(key: string): SearchReport | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    if (cached.key !== key || Date.now() - cached.at > 20_000) return null;
    return cached.body;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION);
  } catch {
    // The next search still contacts FDA and USDA.
  }
}

export function writeSession(key: string, body: SearchReport): void {
  try {
    const cached: Cached = { at: Date.now(), key, body };
    window.sessionStorage.setItem(SESSION, JSON.stringify(cached));
  } catch {
    // The page still shows the response it just received.
  }
}

export function readLast(key: string): SearchReport | null {
  const cached = readJson<Cached>(LAST);
  if (!cached || cached.key !== key) return null;
  return cached.body;
}

export function writeLast(key: string, body: SearchReport): void {
  try {
    const cached: Cached = { at: Date.now(), key, body };
    window.localStorage.setItem(LAST, JSON.stringify(cached));
  } catch {
    // A later network failure will say the sources could not be checked.
  }
}
