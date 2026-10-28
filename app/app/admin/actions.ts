"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { str } from "@/lib/domain";

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

export async function savePayInfo(fd: FormData) {
  const supabase = await admin();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "pay_instructions", value: String(fd.get("value") ?? "").slice(0, 2000) });
  back(error?.message);
}
