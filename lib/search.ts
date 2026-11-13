import { assertFixturesAllowed } from "@/lib/boot";
import { PAGE_SIZE } from "@/lib/copy";
import { searchFsis } from "@/lib/fsis";
import { searchNotices } from "@/lib/notices";
import { searchFda, suggestFdaTerm } from "@/lib/openfda";
import { sanitizeTerm } from "@/lib/query";
import type { SearchInput, SearchReport } from "@/lib/types";
import { resultMessage } from "@/lib/text";

export async function searchRecalls(input: SearchInput): Promise<SearchReport> {
  assertFixturesAllowed();
  const [fda, fsis, notices] = await Promise.all([
    searchFda(input),
    searchFsis(input),
    searchNotices(input),
  ]);
  const message = resultMessage({ fda: fda.state, fsis: fsis.state, notices: notices.state });
  const singleWord = sanitizeTerm(input.q).split(" ").length === 1;
  const suggestion = message && singleWord && !input.separateWords ? await suggestFdaTerm(sanitizeTerm(input.q)) : null;
  return {
    query: input.q,
    page: input.page,
    pageSize: PAGE_SIZE,
    fdaPage: input.fdaPage ?? input.page,
    fsisPage: input.fsisPage ?? input.page,
    noticePage: input.noticePage ?? input.page,
    separateWords: input.separateWords,
    suggestion,
    message,
    retrievedAt: new Date().toISOString(),
    fda,
    fsis,
    notices,
  };
}
