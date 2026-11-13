export type SourceState = "ok" | "empty" | "error";
export type SourceFailure = "timeout" | "unavailable" | "unreadable";

export type StatusFilter = "all" | "ongoing" | "historical";
export type ClassFilter = "all" | "I" | "II" | "III" | "unclassified";

export type SearchInput = {
  q: string;
  page: number;
  status: StatusFilter;
  class: ClassFilter;
  separateWords: boolean;
  from: string | null;
  to: string | null;
  fdaPage?: number;
  fsisPage?: number;
  noticePage?: number;
};

export type FdaGroup = "ongoing" | "historical" | "other";
export type FsisGroup = "active" | "closed" | "alert" | "other";

export type FdaRecord = {
  source: "fda";
  recallNumber: string | null;
  eventId: string | null;
  status: string | null;
  classification: string | null;
  group: FdaGroup;
  productDescription: string | null;
  reason: string | null;
  firm: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  distribution: string | null;
  quantity: string | null;
  codeInfo: string | null;
  moreCodeInfo: string | null;
  initiationDate: string | null;
  classificationDate: string | null;
  reportDate: string | null;
  terminationDate: string | null;
  voluntaryMandated: string | null;
  notification: string | null;
  productType: string | null;
};

export type FsisRecord = {
  source: "fsis";
  recallNumber: string | null;
  title: string | null;
  recallType: string | null;
  classification: string | null;
  riskLevel: string | null;
  group: FsisGroup;
  reason: string | null;
  summary: string | null;
  products: string | null;
  establishment: string | null;
  states: string | null;
  processing: string | null;
  quantity: string | null;
  date: string | null;
  closedYear: string | null;
  url: string | null;
  retailList: string | null;
  labels: string[];
  mediaContact: string | null;
};

export type Notice = {
  title: string;
  url: string;
  published: string | null;
  summary: string | null;
};

export type FdaSection = {
  state: SourceState;
  failure: SourceFailure | null;
  detail: string;
  lastUpdated: string | null;
  total: number;
  ongoingTotal: number | null;
  historicalTotal: number | null;
  records: FdaRecord[];
  truncated: boolean;
};

export type FsisSection = {
  state: SourceState;
  failure: SourceFailure | null;
  detail: string;
  retrievedAt: string | null;
  recallTotal: number;
  alertTotal: number;
  records: FsisRecord[];
  alerts: FsisRecord[];
};

export type NoticeSection = {
  state: SourceState;
  failure: SourceFailure | null;
  detail: string;
  retrievedAt: string | null;
  total: number;
  records: Notice[];
};

export type SearchReport = {
  query: string;
  page: number;
  pageSize: number;
  separateWords: boolean;
  fdaPage: number;
  fsisPage: number;
  noticePage: number;
  suggestion: string | null;
  message: string | null;
  retrievedAt: string;
  fda: FdaSection;
  fsis: FsisSection;
  notices: NoticeSection;
};

export type Fact = {
  label: string;
  value: string | null;
  note?: string;
};

export type RecentReport = {
  retrievedAt: string;
  fda: {
    state: SourceState;
    failure: SourceFailure | null;
    detail: string;
    lastUpdated: string | null;
    ongoing: FdaRecord[];
    historical: FdaRecord[];
  };
  fsis: {
    state: SourceState;
    failure: SourceFailure | null;
    detail: string;
    active: FsisRecord[];
    closed: FsisRecord[];
    alerts: FsisRecord[];
  };
};
