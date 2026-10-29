"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { STD_DOCS, fromLocalInput } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { fetchPublished, type NestTender } from "@/lib/nest";

const NEST_PAGE = "https://nest.go.tz/tenders/published-tenders?category=ALL";

export async function saveKeywords(fd: FormData) {
  const ctx = await requireOrg();
  const supabase = await createClient();
  const keywords = String(fd.get("keywords") ?? "")
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 100);
  const { data } = await supabase.from("organizations").select("settings").eq("id", ctx.orgId).single();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...((data?.settings as object) ?? {}), nest_keywords: keywords } })
    .eq("id", ctx.orgId);
  revalidatePath("/app/nest");
  redirect(`/app/nest${error ? `?msg=${encodeURIComponent(error.message)}` : "?saved=1"}`);
}

export async function addFromNest(fd: FormData) {
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const supabase = await createClient();
  // Only tender numbers come from the browser; the details are read from NeST again.
  const nos = new Set(fd.getAll("pick").map(String).slice(0, 50));
  let picked: NestTender[];
  try {
    picked = (await fetchPublished()).filter((x) => nos.has(x.no));
  } catch {
    redirect(`/app/nest?msg=${encodeURIComponent(t("nest_fail"))}`);
  }

  let added = 0;
  for (const x of picked) {
    const { data, error } = await supabase
      .from("tenders")
      .insert({
        org_id: ctx.orgId,
        tender_no: x.no.slice(0, 200),
        title: x.title.slice(0, 1000),
        entity: x.entity?.slice(0, 300) || null,
        category: ["goods", "works", "nc", "cons"].includes(x.category) ? x.category : "goods",
        method: x.method?.slice(0, 200) || null,
        published_at: /^\d{4}-\d{2}-\d{2}$/.test(x.publishedAt ?? "") ? x.publishedAt : null,
        deadline: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x.deadline ?? "") ? fromLocalInput(x.deadline!) : null,
        notes: x.reference ? `Ref: ${x.reference}${x.lots > 1 ? ` · ${t("lots")}: ${x.lots}` : ""}` : null,
        source: "nest",
        nest_url: NEST_PAGE,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !data) continue; // already in the register (unique number) or not allowed
    added++;
    await supabase
      .from("tender_documents")
      .insert(STD_DOCS.map(([k, sw, en], i) => ({ tender_id: data.id, std_key: k, label: lang === "sw" ? sw : en, sort: i })));
    await supabase.from("activity_log").insert({ tender_id: data.id, user_id: ctx.userId, text: t("nest_fromNest") });
  }
  revalidatePath("/app", "layout");
  redirect(`/app/nest?added=${added}`);
}
