// Public NeST tender listing (no login). The same GraphQL call the
// nest.go.tz "Published tenders" page makes.
const ENDPOINT = "https://nest.go.tz/gateway/nest-app/graphql";
const QUERY = `query getPublishedEntityViewData($input: DataRequestInputInput, $withMetaData: Boolean) {
  items: getPublishedEntityViewData(input: $input, withMetaData: $withMetaData) {
    totalPages totalRecords currentPage hasNext
    rows: data {
      descriptionOfTheProcurement entityNumber entityStatus entitySubCategoryName entityType
      invitationDate lotCount procurementCategoryName procurementCategoryAcronym: entityCategoryAcronym
      procuringEntityName submissionOrOpeningDate referenceNumber
    }
  }
}`;

export type NestTender = {
  no: string;
  title: string;
  entity: string;
  category: "goods" | "works" | "nc" | "cons";
  method: string;
  publishedAt: string | null; // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DDTHH:MM, East Africa Time
  lots: number;
  reference: string | null;
};

type Row = {
  descriptionOfTheProcurement: string | null;
  entityNumber: string | null;
  entitySubCategoryName: string | null;
  entityType: string | null;
  invitationDate: string | null;
  lotCount: number | null;
  procurementCategoryAcronym: string | null;
  procuringEntityName: string | null;
  submissionOrOpeningDate: string | null;
  referenceNumber: string | null;
};

const CAT: Record<string, NestTender["category"]> = { G: "goods", W: "works", NC: "nc", C: "cons" };
const TYPE: Record<string, string> = { TENDER: "Tender", FRAMEWORK: "Framework", PLANNED_TENDER: "Quotation" };

async function page(n: number) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      operationName: "getPublishedEntityViewData",
      query: QUERY,
      variables: {
        input: {
          page: n,
          pageSize: 100,
          fields: [{ fieldName: "invitationDate", isSortable: true, orderDirection: "DESC" }],
          mustHaveFilters: [{ fieldName: "entityStatus", operation: "IN", inValues: ["PUBLISHED"] }],
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`NeST ${res.status}`);
  const json = (await res.json()) as { data?: { items?: { totalPages: number | null; hasNext: boolean; rows: Row[] } } };
  const items = json.data?.items;
  if (!items) throw new Error("NeST: unexpected response");
  return items;
}

// NeST changes a few times a day, so one fetch is reused for a while by every
// company served from the same worker instead of paging NeST on each visit.
// Only the finished list is kept: Workers cannot share pending I/O between requests.
const TTL = 10 * 60 * 1000;
let cached: { at: number; list: NestTender[] } | null = null;

/** Every published tender, one entry per tender number (lots collapsed). */
export async function fetchPublished(): Promise<NestTender[]> {
  if (cached && Date.now() - cached.at < TTL) return cached.list;
  const list = await load();
  cached = { at: Date.now(), list };
  return list;
}

async function load(maxPages = 6): Promise<NestTender[]> {
  const first = await page(1);
  const rest = await Promise.all(
    Array.from({ length: Math.min(first.totalPages ?? (first.hasNext ? maxPages : 1), maxPages) - 1 }, (_, i) => page(i + 2)),
  );
  const seen = new Map<string, NestTender>();
  for (const { rows } of [first, ...rest]) {
    for (const r of rows) {
      const no = r.entityNumber?.trim();
      if (!no || seen.has(no)) continue;
      seen.set(no, {
        no,
        title: (r.descriptionOfTheProcurement ?? "").trim() || no,
        entity: (r.procuringEntityName ?? "").trim(),
        category: CAT[(r.procurementCategoryAcronym ?? "").toUpperCase()] ?? "goods",
        method: [r.entitySubCategoryName, r.entityType ? `(${TYPE[r.entityType] ?? r.entityType})` : ""].filter(Boolean).join(" "),
        publishedAt: r.invitationDate ? r.invitationDate.slice(0, 10) : null,
        deadline: r.submissionOrOpeningDate ? r.submissionOrOpeningDate.slice(0, 16) : null,
        lots: r.lotCount ?? 1,
        reference: r.referenceNumber,
      });
    }
  }
  return [...seen.values()];
}

export const DEFAULT_KEYWORDS = [
  "ICT", "computer", "laptop", "desktop", "printer", "toner", "network", "server", "UPS", "CCTV", "projector",
  "stationery", "office supplies", "office equipment", "furniture", "cement", "reinforcement", "steel", "iron sheets",
  "roofing", "timber", "paint", "tiles", "plumbing", "electrical materials", "building materials",
  "construction materials", "hardware", "food", "rice", "maize", "beans", "sugar", "cooking oil", "school feeding",
  "cleaning materials", "detergents", "general supplies", "uniforms",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Keywords match the start of a word, so "laptop" also finds "laptops". */
export function matcher(keywords: string[]) {
  const words = keywords.map((k) => k.trim()).filter(Boolean);
  if (!words.length) return () => true;
  const re = new RegExp(`\\b(?:${words.map(esc).join("|")})`, "i");
  return (t: NestTender) => re.test(`${t.title} ${t.method}`);
}
