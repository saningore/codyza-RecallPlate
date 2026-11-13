import { Suspense } from "react";
import SearchExperience from "@/components/SearchExperience";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-lg">Loading search.</p>}>
      <SearchExperience />
    </Suspense>
  );
}
