import { FIXTURE_REFUSAL } from "@/lib/copy";

export function assertFixturesAllowed(): void {
  if (process.env.RECALLPLATE_USE_FIXTURES === "1") {
    throw new Error(FIXTURE_REFUSAL);
  }
}
