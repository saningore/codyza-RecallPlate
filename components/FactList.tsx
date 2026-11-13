import { factText } from "@/lib/facts";
import type { Fact } from "@/lib/types";

export default function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="mt-8 grid gap-5 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="border-t border-line pt-3">
          <dt className="text-sm font-bold">{fact.label}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{factText(fact.value)}</dd>
          {fact.note ? <p className="mt-2 text-sm text-ink/70">{fact.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}
