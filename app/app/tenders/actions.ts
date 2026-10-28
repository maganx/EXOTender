"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { STAGES, STD_DOCS, fromLocalInput, num, str, type Stage } from "@/lib/domain";
import { getT } from "@/lib/i18n";

const DELIVERY = ["planned", "delivered", "accepted"];
const DOC_STATUS = ["pending", "done", "na"];

function back(id: string, tab: string, error?: string | null): never {
  revalidatePath("/app", "layout");
  redirect(`/app/tenders/${id}?tab=${tab}${error ? `&msg=${encodeURIComponent(error)}` : "&ok=1"}`);
}

function safeUrl(v: FormDataEntryValue | null) {
  const s = str(v);
  return s && /^https:\/\//i.test(s) ? s : null;
}

async function log(tenderId: string, text: string) {
  const ctx = await requireOrg();
  await (await createClient()).from("activity_log").insert({ tender_id: tenderId, user_id: ctx.userId, text });
}

export async function createTender(fd: FormData) {
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const supabase = (await createClient());
  const { data, error } = await supabase
    .from("tenders")
    .insert({
      org_id: ctx.orgId,
      tender_no: str(fd.get("tender_no")),
      title: str(fd.get("title")),
      entity: str(fd.get("entity")),
      category: String(fd.get("category") ?? "goods"),
      deadline: fromLocalInput(String(fd.get("deadline") ?? "")),
      nest_url: safeUrl(fd.get("nest_url")),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/app/tenders/new?msg=${encodeURIComponent(error?.message ?? "error")}`);
  await supabase.from("tender_documents").insert(
    STD_DOCS.map(([k, sw, en], i) => ({ tender_id: data.id, std_key: k, label: lang === "sw" ? sw : en, sort: i })),
  );
  await log(data.id, t("created"));
  back(data.id, "info");
}

export async function saveInfo(fd: FormData) {
  const id = String(fd.get("id"));
  const { error } = await (await createClient())
    .from("tenders")
    .update({
      tender_no: str(fd.get("tender_no")),
      title: str(fd.get("title")),
      entity: str(fd.get("entity")),
      category: String(fd.get("category") ?? "goods"),
      method: str(fd.get("method")),
      region: str(fd.get("region")),
      published_at: str(fd.get("published_at")),
      clarify_by: str(fd.get("clarify_by")),
      deadline: fromLocalInput(String(fd.get("deadline") ?? "")),
      opening_at: fromLocalInput(String(fd.get("opening_at") ?? "")),
      validity_days: num(fd.get("validity_days")) ?? 90,
      bid_security_type: String(fd.get("bid_security_type") ?? "decl"),
      bid_security_amount: num(fd.get("bid_security_amount")),
      bid_security_expiry: str(fd.get("bid_security_expiry")),
      nest_url: safeUrl(fd.get("nest_url")),
      notes: str(fd.get("notes")),
    })
    .eq("id", id);
  back(id, "info", error?.message);
}

export async function setStage(fd: FormData) {
  const id = String(fd.get("id"));
  const stage = String(fd.get("stage")) as Stage;
  if (![...STAGES, "lost"].includes(stage)) back(id, String(fd.get("tab") ?? "info"), "bad stage");
  const { t } = (await getT());
  const { error } = await (await createClient()).from("tenders").update({ stage }).eq("id", id);
  if (!error) await log(id, `${t("stageMoved")} ${t(`s_${stage}`)}`);
  back(id, String(fd.get("tab") ?? "info"), error?.message);
}

export async function deleteTender(fd: FormData) {
  const id = String(fd.get("id"));
  const { error } = await (await createClient()).from("tenders").delete().eq("id", id);
  if (error) back(id, "info", error.message);
  revalidatePath("/app", "layout");
  redirect("/app/tenders");
}

/* ---------- documents ---------- */
export async function addDoc(fd: FormData) {
  const id = String(fd.get("id"));
  const label = str(fd.get("label"));
  if (!label) back(id, "docs");
  const { error } = await (await createClient())
    .from("tender_documents")
    .insert({ tender_id: id, label, section: str(fd.get("section")), note: str(fd.get("note")), sort: 100 });
  back(id, "docs", error?.message);
}

export async function addStdDocs(fd: FormData) {
  const id = String(fd.get("id"));
  const { lang } = (await getT());
  const supabase = (await createClient());
  const { data: have } = await supabase.from("tender_documents").select("std_key").eq("tender_id", id);
  const got = new Set((have ?? []).map((d) => d.std_key));
  const rows = STD_DOCS.filter(([k]) => !got.has(k)).map(([k, sw, en], i) => ({ tender_id: id, std_key: k, label: lang === "sw" ? sw : en, sort: i }));
  const { error } = rows.length ? await supabase.from("tender_documents").insert(rows) : { error: null };
  back(id, "docs", error?.message);
}

export async function saveDoc(fd: FormData) {
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  const docId = String(fd.get("doc_id"));
  if (fd.get("remove")) {
    const { error } = await (await createClient()).from("tender_documents").delete().eq("id", docId).eq("tender_id", id);
    back(id, "docs", error?.message);
  }
  const { error } = await (await createClient())
    .from("tender_documents")
    .update({
      status: DOC_STATUS.includes(status) ? status : "pending",
      section: str(fd.get("section")),
      note: str(fd.get("note")),
      company_document_id: str(fd.get("company_document_id")),
    })
    .eq("id", docId)
    .eq("tender_id", id);
  back(id, "docs", error?.message);
}

/* ---------- pricing ---------- */
export async function savePricing(fd: FormData) {
  const id = String(fd.get("id"));
  const { error } = await (await createClient())
    .from("tender_pricing")
    .upsert({
      tender_id: id,
      cost: num(fd.get("cost")),
      transport: num(fd.get("transport")),
      other: num(fd.get("other")),
      bid_price: num(fd.get("bid_price")),
    });
  back(id, "price", error?.message);
}

/* ---------- award & contract ---------- */
export async function saveContract(fd: FormData) {
  const id = String(fd.get("id"));
  const { error } = await (await createClient())
    .from("tender_contracts")
    .upsert({
      tender_id: id,
      award_date: str(fd.get("award_date")),
      award_amount: num(fd.get("award_amount")),
      standstill_end: str(fd.get("standstill_end")),
      accepted_at: str(fd.get("accepted_at")),
      contract_no: str(fd.get("contract_no")),
      signed_at: str(fd.get("signed_at")),
      contract_value: num(fd.get("contract_value")),
      start_date: str(fd.get("start_date")),
      end_date: str(fd.get("end_date")),
      lpo_no: str(fd.get("lpo_no")),
      ps_amount: num(fd.get("ps_amount")),
      ps_expiry: str(fd.get("ps_expiry")),
      ps_submitted: fd.get("ps_submitted") === "true",
    });
  back(id, "contract", error?.message);
}

/* ---------- deliveries ---------- */
export async function addDelivery(fd: FormData) {
  const id = String(fd.get("id"));
  const { error } = await (await createClient()).from("deliveries").insert({ tender_id: id, item: str(fd.get("item")) ?? "" });
  back(id, "supply", error?.message);
}

export async function saveDelivery(fd: FormData) {
  const id = String(fd.get("id"));
  const rowId = String(fd.get("row_id"));
  const supabase = (await createClient());
  if (fd.get("remove")) {
    const { error } = await supabase.from("deliveries").delete().eq("id", rowId).eq("tender_id", id);
    back(id, "supply", error?.message);
  }
  const status = String(fd.get("status"));
  const { error } = await supabase
    .from("deliveries")
    .update({
      item: str(fd.get("item")) ?? "",
      qty: str(fd.get("qty")),
      delivery_date: str(fd.get("delivery_date")),
      delivery_note: str(fd.get("delivery_note")),
      status: DELIVERY.includes(status) ? status : "planned",
    })
    .eq("id", rowId)
    .eq("tender_id", id);
  back(id, "supply", error?.message);
}

/* ---------- invoices ---------- */
export async function addInvoice(fd: FormData) {
  const id = String(fd.get("id"));
  const { error } = await (await createClient())
    .from("invoices")
    .insert({ tender_id: id, invoice_no: str(fd.get("invoice_no")), amount: num(fd.get("amount")) ?? 0 });
  back(id, "pay", error?.message);
}

export async function saveInvoice(fd: FormData) {
  const id = String(fd.get("id"));
  const rowId = String(fd.get("row_id"));
  const supabase = (await createClient());
  if (fd.get("remove")) {
    const { error } = await supabase.from("invoices").delete().eq("id", rowId).eq("tender_id", id);
    back(id, "pay", error?.message);
  }
  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_no: str(fd.get("invoice_no")),
      invoice_date: str(fd.get("invoice_date")),
      amount: num(fd.get("amount")) ?? 0,
      paid: num(fd.get("paid")) ?? 0,
      paid_on: str(fd.get("paid_on")),
    })
    .eq("id", rowId)
    .eq("tender_id", id);
  back(id, "pay", error?.message);
}

/* ---------- log ---------- */
export async function addNote(fd: FormData) {
  const id = String(fd.get("id"));
  const text = str(fd.get("text"));
  if (text) await log(id, text.slice(0, 2000));
  back(id, "log");
}
