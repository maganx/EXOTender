"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { str } from "@/lib/domain";

const METHODS = ["mpesa", "mixx", "airtel", "halopesa", "bank", "other"];

export async function reportPayment(fd: FormData) {
  const ctx = await requireOrg();
  const method = String(fd.get("method"));
  const { error } = await (await createClient()).from("payments").insert({
    org_id: ctx.orgId,
    plan_id: String(fd.get("plan")),
    // the database sets the real price and length from the plan
    months: 1,
    amount_tzs: 0,
    method: METHODS.includes(method) ? method : "other",
    reference: (str(fd.get("reference")) ?? "").slice(0, 100),
    payer_phone: str(fd.get("phone"))?.slice(0, 30) ?? null,
    submitted_by: ctx.userId,
  });
  revalidatePath("/app/billing");
  redirect(`/app/billing?${error ? `msg=${encodeURIComponent(error.message)}` : "sent=1"}`);
}
