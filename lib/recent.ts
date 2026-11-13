import { assertFixturesAllowed } from "@/lib/boot";
import { recentFsis } from "@/lib/fsis";
import { recentFda } from "@/lib/openfda";
import type { RecentReport } from "@/lib/types";

export async function loadRecent(): Promise<RecentReport> {
  assertFixturesAllowed();
  const [fda, fsis] = await Promise.all([recentFda(), recentFsis()]);
  return { retrievedAt: new Date().toISOString(), fda, fsis };
}
