type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();

export async function remember<T>(key: string, ttlMs: number, load: () => Promise<T | null>): Promise<T | null> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  if (value != null) store.set(key, { at: Date.now(), value });
  return value;
}
