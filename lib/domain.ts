import type { Lang, T } from "./i18n";

export const STAGES = ["found", "prep", "submitted", "eval", "awarded", "contract", "supply", "payment", "closed"] as const;
export const ACTIVE = ["found", "prep", "submitted", "eval", "awarded", "contract", "supply", "payment"] as const;
export const WON = ["awarded", "contract", "supply", "payment", "closed"] as const;
export type Stage = (typeof STAGES)[number] | "lost";
export type Role = "owner" | "admin" | "officer" | "finance" | "viewer";
export const ROLES: Role[] = ["owner", "admin", "officer", "finance", "viewer"];

export const canEdit = (r: Role) => r === "owner" || r === "admin" || r === "officer";
export const canSeeMoney = (r: Role) => r !== "viewer";
export const canEditPayments = (r: Role) => r === "owner" || r === "admin" || r === "finance";
export const isAdmin = (r: Role) => r === "owner" || r === "admin";

export const STD_DOCS: [string, string, string][] = [
  ["brela", "Cheti cha usajili wa kampuni (BRELA)", "Certificate of incorporation (BRELA)"],
  ["tin", "Cheti cha TIN", "TIN certificate"],
  ["taxclear", "Tax clearance hai (TRA)", "Valid tax clearance (TRA)"],
  ["vat", "Cheti cha VAT", "VAT certificate"],
  ["license", "Leseni ya biashara", "Business licence"],
  ["nest", "Usajili hai wa NeST", "Active NeST registration"],
  ["poa", "Power of attorney ya kusaini zabuni", "Power of attorney to sign the bid"],
  ["bidform", "Fomu ya zabuni imejazwa na kusainiwa", "Bid form filled and signed"],
  ["price", "Price schedule / BOQ", "Price schedule / BOQ"],
  ["specs", "Uzingatiaji wa specifications", "Technical specification compliance"],
  ["bidsec", "Bid security / Bid Securing Declaration", "Bid security / Bid Securing Declaration"],
  ["mfr", "Manufacturer's authorization", "Manufacturer's authorization"],
  ["literature", "Brochures / catalogues za bidhaa", "Product brochures / catalogues"],
  ["experience", "Uzoefu: mikataba iliyotangulia", "Experience: previous contracts"],
  ["financial", "Hesabu za fedha zilizokaguliwa", "Audited financial statements"],
];
export const stdLabel = (key: string, lang: Lang) => {
  const d = STD_DOCS.find((x) => x[0] === key);
  return d ? (lang === "sw" ? d[1] : d[2]) : key;
};

export type Tender = {
  id: string;
  org_id: string;
  tender_no: string;
  title: string;
  entity: string | null;
  category: string;
  method: string | null;
  region: string | null;
  stage: Stage;
  published_at: string | null;
  clarify_by: string | null;
  deadline: string | null;
  opening_at: string | null;
  validity_days: number;
  bid_security_type: string;
  bid_security_amount: number | null;
  bid_security_expiry: string | null;
  notes: string | null;
  source: string;
  nest_url: string | null;
  created_at: string;
  updated_at: string;
};
export type Pricing = { cost: number | null; transport: number | null; other: number | null; bid_price: number | null };
export type Contract = {
  award_date: string | null; award_amount: number | null; standstill_end: string | null; accepted_at: string | null;
  contract_no: string | null; signed_at: string | null; contract_value: number | null; start_date: string | null;
  end_date: string | null; lpo_no: string | null; ps_amount: number | null; ps_expiry: string | null; ps_submitted: boolean;
};
export type Delivery = { id: string; item: string; qty: string | null; delivery_date: string | null; delivery_note: string | null; status: "planned" | "delivered" | "accepted" };
export type Invoice = { id: string; invoice_no: string | null; invoice_date: string | null; amount: number; paid: number; paid_on: string | null };
export type TDoc = { id: string; std_key: string | null; label: string; section: string | null; note: string | null; page: number | null; status: "pending" | "done" | "na"; company_document_id: string | null };

/* ---------- formatting ---------- */
const MON = {
  sw: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
// dates are shown in East Africa Time whatever the server's zone
const EAT_OFFSET = 3 * 60 * 60 * 1000;
function eatParts(s: string) {
  const d = new Date(s.length === 10 ? s + "T00:00:00+03:00" : s);
  if (isNaN(+d)) return null;
  return new Date(+d + EAT_OFFSET);
}
export function fmtDate(s: string | null | undefined, lang: Lang, withTime = false) {
  if (!s) return "—";
  const d = eatParts(s);
  if (!d) return "—";
  let r = `${d.getUTCDate()} ${MON[lang][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (withTime && s.length > 10) r += `, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return r;
}
/** value for <input type="datetime-local"> in EAT */
export function toLocalInput(s: string | null) {
  if (!s) return "";
  const d = eatParts(s);
  return d ? d.toISOString().slice(0, 16) : "";
}
/** <input type="datetime-local"> value (EAT) -> ISO */
export function fromLocalInput(v: string) {
  return v ? new Date(v + ":00+03:00").toISOString() : null;
}
export function daysUntil(s: string | null | undefined) {
  if (!s) return null;
  const d = eatParts(s);
  const n = eatParts(new Date().toISOString());
  if (!d || !n) return null;
  const a = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 864e5);
}
export function addDays(s: string | null | undefined, n: number) {
  if (!s) return null;
  const d = eatParts(s);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function money(n: number | null | undefined, compact = false) {
  if (n == null || !isFinite(Number(n))) return "—";
  n = Number(n);
  if (compact) {
    const a = Math.abs(n);
    if (a >= 1e9) return "TSh " + (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B";
    if (a >= 1e6) return "TSh " + (n / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (a >= 1e3) return "TSh " + Math.round(n / 1e3) + "K";
  }
  return "TSh " + Math.round(n).toLocaleString("en-US");
}
export function dueLabel(s: string | null | undefined, t: T) {
  const n = daysUntil(s);
  if (n == null) return null;
  const cls = n <= 3 ? "bad" : n <= 7 ? "warn" : "";
  const text = n < 0 ? t("late", { n: -n }) : n === 0 ? t("today") : n === 1 ? t("tomorrow") : t("inDays", { n });
  return { cls, text, n };
}

/* ---------- next action ---------- */
export type Summary = {
  docsDone: number;
  docsTotal: number;
  deliveries: number;
  accepted: number;
  invoices: number;
  outstanding: number;
  value: number;
  bid: number;
  psSubmitted: boolean;
  psExpiry: string | null;
  signedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  awardDate: string | null;
  standstillEnd: string | null;
};

export function nextAction(x: Tender, s: Summary, t: T, lang: Lang): { text: string; due: string | null } | null {
  switch (x.stage) {
    case "found":
      return { text: t("na_found"), due: x.deadline };
    case "prep":
      return { text: t("na_prep", { d: s.docsDone, n: s.docsTotal }), due: x.deadline };
    case "submitted":
      return { text: t("na_submitted"), due: x.opening_at || x.deadline };
    case "eval": {
      const v = addDays(x.deadline, x.validity_days || 90);
      return { text: `${t("na_eval")} · ${t("validTill")} ${fmtDate(v, lang)}`, due: v };
    }
    case "awarded":
      return { text: t("na_awarded"), due: s.standstillEnd || addDays(s.awardDate, 28) };
    case "contract":
      return s.psSubmitted
        ? { text: t("na_contract"), due: s.startDate }
        : { text: t("na_ps"), due: addDays(s.signedAt, 28) };
    case "supply":
      return s.deliveries
        ? { text: t("na_supply", { d: s.accepted, n: s.deliveries }), due: s.endDate }
        : { text: t("na_supply0"), due: s.endDate };
    case "payment":
      if (!s.invoices) return { text: t("na_payment0"), due: null };
      if (s.outstanding <= 0) return { text: t("na_close"), due: null };
      return { text: t("na_payment", { a: money(s.outstanding) }), due: null };
    default:
      return null;
  }
}

export const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
};
export const str = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
