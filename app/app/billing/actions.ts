"use server";

import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { canEditPayments, str } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { createOrder, pushToPhone, selcomConfigured, selcomOk, settleOrder, tzPhone } from "@/lib/selcom";

const METHODS = ["mpesa", "mixx", "airtel", "halopesa", "bank", "other"];

function back(q: string): never {
  revalidatePath("/app/billing");
  redirect(`/app/billing?${q}`);
}

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
  back(error ? `msg=${encodeURIComponent(error.message)}` : "sent=1");
}

/** Opens a Selcom checkout order for a plan and sends the PIN prompt to the phone. */
export async function payWithSelcom(fd: FormData) {
  const ctx = await requireOrg();
  const { t } = await getT();
  if (!canEditPayments(ctx.role)) back(`msg=${encodeURIComponent(t("bill_only"))}`);
  if (!selcomConfigured()) back(`msg=${encodeURIComponent(t("sel_off"))}`);
  const phone = tzPhone(String(fd.get("phone") ?? ""));
  if (!phone) back(`msg=${encodeURIComponent(t("sel_badPhone"))}`);

  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("id, price_tzs, name_en").eq("id", String(fd.get("plan"))).eq("active", true).maybeSingle();
  if (!plan) back(`msg=${encodeURIComponent(t("sel_failed"))}`);
  const { data: who } = await supabase.auth.getUser();

  const orderId = `TD${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const site = await siteUrl();
  let gatewayUrl: string | null = null;
  try {
    const order = await createOrder({
      orderId,
      amount: Number(plan.price_tzs),
      email: who.user?.email ?? "billing@tendadesk.tz",
      name: ctx.orgName.slice(0, 60),
      phone,
      site,
      remarks: `Tenda Desk ${plan.name_en}`,
    });
    if (!selcomOk(order)) {
      console.error("selcom order", order);
      back(`msg=${encodeURIComponent(`${t("sel_failed")} ${order.message ?? ""}`.trim())}`);
    }
    const url = (order.data?.[0] as { payment_gateway_url?: string } | undefined)?.payment_gateway_url;
    if (url) {
      try {
        gatewayUrl = atob(url);
      } catch {
        gatewayUrl = url;
      }
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // a redirect from back()
    console.error("selcom order", e);
    back(`msg=${encodeURIComponent(t("sel_failed"))}`);
  }

  const { error } = await supabase.from("payments").insert({
    org_id: ctx.orgId,
    plan_id: plan.id,
    months: 1,
    amount_tzs: 0,
    method: "selcom",
    reference: orderId,
    order_id: orderId,
    gateway_url: gatewayUrl && /^https:\/\/[^/]*selcom/.test(gatewayUrl) ? gatewayUrl : null,
    payer_phone: phone,
    submitted_by: ctx.userId,
  });
  if (error) back(`msg=${encodeURIComponent(error.message)}`);

  // the PIN prompt is a convenience: the checkout page still works if it fails
  try {
    const push = await pushToPhone(orderId, phone);
    if (!selcomOk(push)) console.error("selcom push", push);
  } catch (e) {
    console.error("selcom push", e);
  }
  back(`order=${orderId}`);
}

/** Asks Selcom whether an order of this company has been paid. */
export async function checkSelcom(fd: FormData) {
  const ctx = await requireOrg();
  const orderId = String(fd.get("order"));
  const { data } = await (await createClient()).from("payments").select("order_id").eq("org_id", ctx.orgId).eq("order_id", orderId).maybeSingle();
  if (!data) back("");
  const r = await settleOrder(orderId);
  back(r === "approved" ? "paid=1" : r === "closed" ? "closed=1" : `order=${orderId}&checked=1`);
}
