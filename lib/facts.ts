import { DISTRIBUTION_NOTE, MISSING, NO_INSTRUCTIONS } from "@/lib/copy";
import type { Fact, FdaRecord, FsisRecord } from "@/lib/types";
import { displayStatus, shownDate } from "@/lib/text";

export function fdaFacts(record: FdaRecord): Fact[] {
  return [
    { label: "Product description", value: record.productDescription },
    { label: "Brand", value: null },
    { label: "Recalling firm", value: record.firm },
    { label: "Address", value: joinAddress(record) },
    { label: "City", value: record.city },
    { label: "State", value: record.state },
    { label: "Postal code", value: record.postalCode },
    { label: "Country", value: record.country },
    { label: "Recall reason", value: record.reason },
    { label: "Recall initiation date", value: dated(record.initiationDate) },
    { label: "Center classification date", value: dated(record.classificationDate) },
    { label: "Report date", value: dated(record.reportDate) },
    { label: "Termination date", value: dated(record.terminationDate) },
    { label: "Distribution", value: record.distribution, note: record.distribution ? DISTRIBUTION_NOTE : undefined },
    { label: "Classification", value: record.classification },
    { label: "Status", value: displayStatus(record.status, "fda") },
    { label: "Recall number", value: record.recallNumber },
    { label: "Event ID", value: record.eventId },
    { label: "Product type", value: record.productType },
    { label: "Quantity", value: record.quantity },
    { label: "Code information", value: record.codeInfo },
    { label: "More code information", value: record.moreCodeInfo },
    { label: "Voluntary or mandated", value: record.voluntaryMandated },
    { label: "Initial firm notification", value: record.notification },
    { label: "Consumer instructions", value: NO_INSTRUCTIONS },
  ];
}

export function fsisFacts(record: FsisRecord): Fact[] {
  const facts: Fact[] = [
    { label: "Title", value: record.title },
    { label: "Product", value: record.products },
    { label: "Brand", value: null },
    { label: "Establishment", value: record.establishment },
    { label: "Recall reason", value: record.reason },
    { label: "Summary", value: record.summary },
    { label: "Recall date", value: dated(record.date) },
    { label: "Closed year", value: record.closedYear },
    { label: "Distribution", value: record.states },
    { label: "Classification", value: record.classification },
    { label: "Risk level", value: record.riskLevel },
    { label: "Status", value: displayStatus(record.recallType, "fsis") },
    { label: "Recall number", value: record.recallNumber },
    { label: "Processing", value: record.processing },
    { label: "Quantity recovered", value: record.quantity },
    { label: "Company media contact", value: record.mediaContact },
  ];
  if (!record.summary) facts.push({ label: "Consumer instructions", value: NO_INSTRUCTIONS });
  return facts;
}

function dated(value: string | null): string | null {
  if (!value) return null;
  const shown = shownDate(value);
  return shown === MISSING ? null : shown;
}

function joinAddress(record: FdaRecord): string | null {
  const lines = [record.address1, record.address2].filter(Boolean);
  return lines.length ? lines.join(", ") : null;
}

export function factText(value: string | null): string {
  return value && value.trim() ? value : MISSING;
}
