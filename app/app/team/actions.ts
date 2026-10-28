"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { ROLES } from "@/lib/domain";

function back(error?: string | null): never {
  revalidatePath("/app/team");
  redirect(`/app/team${error ? `?msg=${encodeURIComponent(error)}` : ""}`);
}

export async function invite(fd: FormData) {
  const ctx = await requireOrg();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role"));
  if (!email || !ROLES.includes(role as never) || role === "owner") back("bad input");
  const { error } = await (await createClient()).from("invitations").insert({ org_id: ctx.orgId, email, role, invited_by: ctx.userId });
  back(error?.message);
}

export async function cancelInvite(fd: FormData) {
  const { error } = await (await createClient()).from("invitations").delete().eq("id", String(fd.get("inv")));
  back(error?.message);
}

export async function setRole(fd: FormData) {
  const ctx = await requireOrg();
  const role = String(fd.get("role"));
  if (!ROLES.includes(role as never)) back("bad role");
  const { error } = await (await createClient()).from("memberships").update({ role }).eq("org_id", ctx.orgId).eq("user_id", String(fd.get("user")));
  back(error?.message);
}

export async function removeMember(fd: FormData) {
  const ctx = await requireOrg();
  const { error } = await (await createClient()).from("memberships").delete().eq("org_id", ctx.orgId).eq("user_id", String(fd.get("user")));
  back(error?.message);
}
