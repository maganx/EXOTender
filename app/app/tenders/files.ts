"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { STD_DOCS, canEdit } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { MAX_CHARS, readTender, type ReadItem, type SupplyItem } from "@/lib/reader";
import { serverEnv } from "@/lib/env";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const KINDS = ["tender", "bid", "other"];
const monthlyReads = () => Number(serverEnv("AI_MONTHLY_READS") || 30);

async function ownTender(id: string) {
  const ctx = await requireOrg();
  const supabase = await createClient();
  const { data } = await supabase.from("tenders").select("id").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  return { ctx, supabase, found: !!data && canEdit(ctx.role) };
}

/** Saves the record of a file the browser has just uploaded to Storage. */
export async function recordTenderFile(input: {
  tenderId: string;
  path: string;
  title: string;
  size: number;
  kind: string;
  docId: string | null;
}): Promise<Result> {
  const { t } = await getT();
  const { ctx, supabase, found } = await ownTender(input.tenderId);
  if (!found) return { ok: false, error: t("notAllowed") };
  const { error } = await supabase.from("tender_files").insert({
    org_id: ctx.orgId,
    tender_id: input.tenderId,
    tender_document_id: input.docId || null,
    kind: KINDS.includes(input.kind) ? input.kind : "bid",
    title: input.title.slice(0, 300) || "file",
    storage_path: input.path,
    size_bytes: input.size,
    uploaded_by: ctx.userId,
  });
  if (error) {
    await supabase.storage.from("company-docs").remove([input.path]);
    return { ok: false, error: error.message };
  }
  // a file attached to a required document marks it as ready
  if (input.docId) await supabase.from("tender_documents").update({ status: "done" }).eq("id", input.docId).eq("tender_id", input.tenderId);
  await supabase.from("activity_log").insert({ tender_id: input.tenderId, user_id: ctx.userId, text: `${t("file_added")}: ${input.title.slice(0, 200)}` });
  revalidatePath(`/app/tenders/${input.tenderId}`);
  return { ok: true };
}

export async function deleteTenderFile(fd: FormData) {
  const tenderId = String(fd.get("id"));
  const { supabase, found } = await ownTender(tenderId);
  if (!found) return;
  const { data } = await supabase.from("tender_files").select("storage_path").eq("id", String(fd.get("file"))).eq("tender_id", tenderId).maybeSingle();
  if (!data) return;
  const { error } = await supabase.from("tender_files").delete().eq("id", String(fd.get("file"))).eq("tender_id", tenderId);
  if (!error) await supabase.storage.from("company-docs").remove([data.storage_path]);
  revalidatePath(`/app/tenders/${tenderId}`);
}

/** Claude reads the tender document text and lists the documents the bid needs. */
export async function readTenderDocument(tenderId: string, text: string): Promise<Result<{ summary: string; documents: ReadItem[]; supplies: SupplyItem[]; left: number }>> {
  const { t, lang } = await getT();
  const { ctx, supabase, found } = await ownTender(tenderId);
  if (!found) return { ok: false, error: t("notAllowed") };
  if (!serverEnv("ANTHROPIC_API_KEY")) return { ok: false, error: t("ai_nokey") };
  const clean = text.replace(/[ \t]+/g, " ").trim();
  if (clean.length < 200) return { ok: false, error: t("ai_notext") };
  if (clean.length > MAX_CHARS) return { ok: false, error: t("ai_toolong") };

  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from("ai_reads").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).gte("at", month.toISOString());
  const left = monthlyReads() - (count ?? 0);
  if (left <= 0) return { ok: false, error: t("ai_limit", { n: monthlyReads() }) };

  try {
    const r = await readTender(clean, lang);
    await supabase.from("ai_reads").insert({ org_id: ctx.orgId, tender_id: tenderId, user_id: ctx.userId, input_tokens: r.inputTokens, output_tokens: r.outputTokens });
    return { ok: true, summary: r.summary, documents: r.documents, supplies: r.supplies, left: left - 1 };
  } catch (e) {
    console.error("tender reader", e);
    return { ok: false, error: t("ai_failed") };
  }
}

/**
 * Adds the documents the person kept from a reading (standard ones update the existing line)
 * and the items to supply, as planned lines under Supply.
 */
export async function addReadDocuments(tenderId: string, items: ReadItem[], summary: string, supplies: SupplyItem[] = []): Promise<Result> {
  const { t } = await getT();
  const { ctx, supabase, found } = await ownTender(tenderId);
  if (!found) return { ok: false, error: t("notAllowed") };
  const { data: have } = await supabase.from("tender_documents").select("id, std_key").eq("tender_id", tenderId);
  const byKey = new Map((have ?? []).filter((d) => d.std_key).map((d) => [d.std_key as string, d.id as string]));
  const std = new Set(STD_DOCS.map(([k]) => k));
  const fresh: Record<string, unknown>[] = [];
  for (const [i, it] of items.slice(0, 80).entries()) {
    const row = {
      label: String(it.label ?? "").slice(0, 300),
      section: String(it.section ?? "").slice(0, 300) || null,
      note: String(it.note ?? "").slice(0, 1000) || null,
      page: Number.isInteger(it.page) ? it.page : null,
    };
    if (!row.label) continue;
    const key = std.has(it.std_key) ? it.std_key : null;
    const existing = key ? byKey.get(key) : undefined;
    if (existing) {
      await supabase.from("tender_documents").update({ section: row.section, note: row.note, page: row.page }).eq("id", existing);
    } else {
      fresh.push({ tender_id: tenderId, std_key: key, ...row, sort: 50 + i });
      if (key) byKey.set(key, "new");
    }
  }
  const { error } = fresh.length ? await supabase.from("tender_documents").insert(fresh) : { error: null };
  if (error) return { ok: false, error: error.message };

  const { data: lines } = await supabase.from("deliveries").select("item").eq("tender_id", tenderId);
  const seen = new Set((lines ?? []).map((l) => String(l.item).trim().toLowerCase()));
  const rows: Record<string, unknown>[] = [];
  for (const s of supplies.slice(0, 150)) {
    const name = String(s.item ?? "").trim();
    if (!name) continue;
    const where = [String(s.site ?? "").trim(), Number.isInteger(s.days) && s.days! > 0 ? t("sup_days", { n: s.days! }) : ""].filter(Boolean).join(", ");
    const item = (where ? `${name} (${where})` : name).slice(0, 300);
    if (seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    // Staggered timestamps keep the schedule's order on the Supply tab, which sorts by created_at.
    rows.push({ tender_id: tenderId, item, qty: String(s.qty ?? "").trim().slice(0, 60) || null, created_at: new Date(Date.now() + rows.length).toISOString() });
  }
  if (rows.length) {
    const { error: e2 } = await supabase.from("deliveries").insert(rows);
    if (e2) return { ok: false, error: e2.message };
  }
  const logged = t("ai_logged", { n: items.length }) + (rows.length ? ` ${t("sup_logged", { n: rows.length })}` : "");
  await supabase.from("activity_log").insert({ tender_id: tenderId, user_id: ctx.userId, text: `${logged} ${summary}`.slice(0, 2000) });
  revalidatePath(`/app/tenders/${tenderId}`);
  return { ok: true };
}
