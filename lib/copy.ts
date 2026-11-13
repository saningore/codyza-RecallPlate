export const USER_AGENT = "RecallPlate/1.0 (https://codyza.com)";
export const FSIS_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const PAGE_SIZE = 20;
export const MAX_SKIP = 25_000;
export const QUERY_LIMIT = 120;

export const NO_MATCH = "No matching recall records were found.";
export const ENTER_QUERY = "Enter a food, product, or company name.";
export const MISSING = "Not included in this record";
export const NOT_GOVERNMENT = "RecallPlate is not a government website. Recall text is taken from the named official source.";
export const NO_GUARANTEE = "A search with no matching records does not mean a product is safe. A source can be delayed, and a product can be recalled without appearing in the weekly extract yet.";
export const FDA_UNCHECKED = "The FDA enforcement catalog could not be checked. No recall was added in its place.";
export const FSIS_UNCHECKED = "USDA FSIS could not be checked. No USDA recall was added in its place.";
export const NOTICE_UNCHECKED = "The FDA notice feed could not be checked. No notice was added in its place.";
export const FDA_EMPTY = "No matching FDA enforcement records were found.";
export const FSIS_EMPTY = "No matching USDA FSIS records were found.";
export const NOTICE_EMPTY = "No matching FDA notices were found.";
export const WORD_MATCH = "Each word matched. The full phrase did not.";
export const OFFLINE_COPY = "This is a saved search, not a new search. FDA and USDA were not contacted again.";
export const DISTRIBUTION_NOTE = "FDA describes this as the general area of initial distribution. Later distribution by other companies may not be included.";
export const PHA_NOTE = "A public health alert is not a recall. FSIS uses it when a recall is not the action it is publishing.";
export const EXTRACT_NOTE = "Status is the status in this weekly extract. openFDA says this dataset should not be used to issue public alerts or to track whether a recall is still open.";
export const COMPARE_NOTE = "Compare the product description, company, codes, dates, and distribution in this record with the package. A similar name is not the same record. This page repeats the agency text and does not decide whether a package matches.";
export const RECENT_NOTE = "These rows were just retrieved from the named official source. This is not the full catalog. An older record can still have a current status, and a missing row is not a statement that a food is safe.";
export const PARTIAL_SOURCE = "One source could not be checked. The records below are only from the sources that responded. No record was added to fill the gap.";
export const NO_INSTRUCTIONS = "This record did not include consumer instructions.";
export const FIXTURE_REFUSAL = "Refusing to start. RECALLPLATE_USE_FIXTURES serves sample records and must be unset.";

export const FDA_ENFORCEMENT = "https://api.fda.gov/food/enforcement.json";
export const FDA_NOTICES = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food-safety-recalls/rss.xml";
export const FSIS_ENDPOINT = "https://www.fsis.usda.gov/fsis/api/recall/v/1";
export const OPENFDA_ABOUT = "https://open.fda.gov/apis/food/enforcement/";
export const ENFORCEMENT_ABOUT = "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/enforcement-reports";
export const FDA_OUTBREAKS = "https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks";
export const CDC_OUTBREAKS = "https://www.cdc.gov/foodsafety/outbreaks/lists/outbreaks-list.html";
export const FSIS_HOME = "https://www.fsis.usda.gov/recalls";
export const FOODSAFETY_GOV = "https://www.foodsafety.gov/recalls-and-outbreaks";

export const CLASS_DEFINITIONS: Record<string, string> = {
  "Class I": "FDA: a situation in which there is a reasonable probability that the use of, or exposure to, a violative product will cause serious adverse health consequences or death.",
  "Class II": "FDA: a situation in which use of, or exposure to, a violative product may cause temporary or medically reversible adverse health consequences, or where the probability of serious adverse health consequences is remote.",
  "Class III": "FDA: a situation in which use of, or exposure to, a violative product is not likely to cause adverse health consequences.",
  "Not Yet Classified": "FDA has not assigned a class in this record.",
};
