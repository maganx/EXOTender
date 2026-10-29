"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { str } from "@/lib/domain";
import { gatewayKey, orderStatus, sha256Hex } from "@/lib/selcom";

// every check is repeated in the database functions; this only keeps others off the page
async function admin() {
  const ctx = await requireOrg();
  if (!ctx.platformAdmin) redirect("/app");
  return createClient();
}

function back(error?: string | null): never {
  revalidatePath("/app/admin");
  redirect(`/app/admin${error ? `?msg=${encodeURIComponent(error)}` : ""}`);
}

export async function reviewPayment(fd: FormData) {
  const supabase = await admin();
  const { error } = await supabase.rpc("review_payment", {
    p_payment: String(fd.get("payment")),
    p_approve: fd.get("approve") === "1",
    p_note: str(fd.get("note")),
  });
  back(error?.message);
}

export async function extendCompany(fd: FormData) {
  const supabase = await admin();
  const days = Math.max(1, Math.min(730, Number(fd.get("days")) || 0));
  const { error } = await supabase.rpc("extend_subscription", { p_org: String(fd.get("org")), p_days: days });
  back(error?.message);
}

/** Keeps a payment link only when it is a plain https address, so the Billing button can't point anywhere odd. */
function payLink(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" ? u.toString().slice(0, 500) : "";
  } catch {
    return "";
  }
}

export async function savePayInfo(fd: FormData) {
  const supabase = await admin();
  const { error } = await supabase.from("platform_settings").upsert([
    { key: "pay_instructions", value: String(fd.get("value") ?? "").slice(0, 2000) },
    { key: "lipa_number", value: String(fd.get("lipa_number") ?? "").replace(/[^0-9 ]/g, "").trim().slice(0, 20) },
    { key: "lipa_name", value: String(fd.get("lipa_name") ?? "").trim().slice(0, 80) },
    { key: "pay_link", value: payLink(String(fd.get("pay_link") ?? "")) },
  ]);
  back(error?.message);
}

/** Stores the hash of the server's Selcom confirmation key, then checks the keys work with one status call. */
export async function enableSelcom() {
  const supabase = await admin();
  const key = await gatewayKey();
  if (!key) back("SELCOM_API_KEY / SELCOM_API_SECRET / SELCOM_VENDOR");
  const { error } = await supabase.rpc("set_gateway_key", { p_hash: await sha256Hex(key) });
  if (error) back(error.message);
  let note = "";
  try {
    const r = await orderStatus("TDTEST0000");
    note = `Selcom: ${r.resultcode ?? "?"} ${r.message ?? r.result ?? ""}`.trim();
  } catch (e) {
    note = `Selcom: ${e instanceof Error ? e.message : "no reply"}`;
  }
  revalidatePath("/app/admin");
  redirect(`/app/admin?selcom=${encodeURIComponent(note)}`);
}
