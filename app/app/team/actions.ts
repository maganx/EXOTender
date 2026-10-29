"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, type OrgCtx } from "@/lib/org";
import { ROLES, fmtDate, type Role } from "@/lib/domain";
import { emailConfigured, inviteEmail, sendEmail } from "@/lib/email";
import { getLang, translator } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

function back(error?: string | null, flag?: string): never {
  revalidatePath("/app/team");
  redirect(`/app/team${error ? `?msg=${encodeURIComponent(error)}` : flag ? `?${flag}=1` : ""}`);
}

/** Emails one invitation; returns an error message, or null once it is sent. */
async function emailInvite(ctx: OrgCtx, inv: { id: string; email: string; role: string; token: string; expires_at: string }) {
  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
  const site = await siteUrl();
  const sw = translator("sw");
  const en = translator("en");
  const mail = inviteEmail({
    site,
    link: `${site}/invite/${inv.token}`,
    org: ctx.orgName,
    inviter: (me?.full_name as string | undefined) || ctx.email,
    role: sw(`r_${inv.role as Role}`),
    roleEn: en(`r_${inv.role as Role}`),
    expires: fmtDate(inv.expires_at, "sw"),
  });
  const sent = await sendEmail({ to: inv.email, ...mail, replyTo: ctx.email || undefined });
  if (!sent.ok) return sent.error;
  await supabase.from("invitations").update({ emailed_at: new Date().toISOString() }).eq("id", inv.id);
  return null;
}

export async function invite(fd: FormData) {
  const ctx = await requireOrg();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role as never) || role === "owner") back("bad input");
  const { data, error } = await (await createClient())
    .from("invitations")
    .insert({ org_id: ctx.orgId, email, role, invited_by: ctx.userId })
    .select("id, email, role, token, expires_at")
    .single();
  if (error || !data) back(error?.message ?? "error");
  if (!emailConfigured()) back(null, "nomail");
  const failed = await emailInvite(ctx, data);
  back(failed ? `${translator(await getLang())("inv_mailFail")} ${failed}` : null, failed ? undefined : "sent");
}

export async function resendInvite(fd: FormData) {
  const ctx = await requireOrg();
  const { data } = await (await createClient())
    .from("invitations")
    .select("id, email, role, token, expires_at")
    .eq("id", String(fd.get("inv")))
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!data) back("not found");
  const failed = await emailInvite(ctx, data);
  back(failed ? `${translator(await getLang())("inv_mailFail")} ${failed}` : null, failed ? undefined : "sent");
}

export async function cancelInvite(fd: FormData) {
  const ctx = await requireOrg();
  const { error } = await (await createClient()).from("invitations").delete().eq("id", String(fd.get("inv"))).eq("org_id", ctx.orgId);
  back(error?.message, "saved");
}

export async function setRole(fd: FormData) {
  const ctx = await requireOrg();
  const role = String(fd.get("role"));
  if (!ROLES.includes(role as never)) back("bad role");
  const { error } = await (await createClient()).from("memberships").update({ role }).eq("org_id", ctx.orgId).eq("user_id", String(fd.get("user")));
  back(error?.message, "saved");
}

export async function removeMember(fd: FormData) {
  const ctx = await requireOrg();
  const { error } = await (await createClient()).from("memberships").delete().eq("org_id", ctx.orgId).eq("user_id", String(fd.get("user")));
  back(error?.message, "saved");
}
