"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || `https://${(await headers()).get("host")}`;
}

// only same-site paths, never an outside address
function safeNext(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/app";
}

export async function signIn(formData: FormData) {
  const supabase = (await createClient());
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error?.code === "email_not_confirmed")
    redirect(`/login?unconfirmed=1&email=${encodeURIComponent(String(formData.get("email") ?? "").trim())}&next=${encodeURIComponent(next)}`);
  if (error) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function resendConfirmation(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/login?msg=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}

export async function signUp(formData: FormData) {
  const supabase = (await createClient());
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    options: {
      data: { full_name: String(formData.get("full_name") ?? "").trim() },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) redirect(`/login?mode=signup&msg=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  if (!data.session) redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signOut() {
  await (await createClient()).auth.signOut();
  (await cookies()).delete("org");
  redirect("/login");
}

export async function setLang(formData: FormData) {
  (await cookies()).set("lang", formData.get("lang") === "en" ? "en" : "sw", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(safeNext(formData.get("back")));
}

export async function setTheme(formData: FormData) {
  (await cookies()).set("theme", formData.get("theme") === "dark" ? "dark" : "light", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(safeNext(formData.get("back")));
}

export async function switchOrg(formData: FormData) {
  (await cookies()).set("org", String(formData.get("org") ?? ""), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}

export async function createOrganization(formData: FormData) {
  const supabase = (await createClient());
  const name = String(formData.get("name") ?? "").trim();
  const { data, error } = await supabase.rpc("create_organization", { p_name: name });
  if (error || !data) redirect(`/onboarding?msg=${encodeURIComponent(error?.message ?? "error")}`);
  const tin = String(formData.get("tin") ?? "").trim();
  if (tin) await supabase.from("organizations").update({ tin }).eq("id", data as string);
  (await cookies()).set("org", data as string, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}

export async function acceptInvitation(formData: FormData) {
  const supabase = (await createClient());
  const token = String(formData.get("token") ?? "");
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) redirect(`/invite/${encodeURIComponent(token)}?bad=1`);
  (await cookies()).set("org", data as string, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}
