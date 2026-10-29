"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { str } from "@/lib/domain";

const MAX = 10 * 1024 * 1024;

function back(error?: string | null): never {
  revalidatePath("/app/documents");
  redirect(`/app/documents${error ? `?msg=${encodeURIComponent(error)}` : "?saved=1"}`);
}

export async function uploadDoc(fd: FormData) {
  const ctx = await requireOrg();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) back("no file");
  if (file.size > MAX) back("max 10 MB");
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${ctx.orgId}/${crypto.randomUUID()}-${safe}`;
  const supabase = (await createClient());
  const up = await supabase.storage.from("company-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up.error) back(up.error.message);
  const { error } = await supabase.from("company_documents").insert({
    org_id: ctx.orgId,
    kind: String(fd.get("kind") ?? "other"),
    title: str(fd.get("title")) ?? file.name,
    storage_path: path,
    expires_on: str(fd.get("expires_on")),
    uploaded_by: ctx.userId,
  });
  if (error) await supabase.storage.from("company-docs").remove([path]);
  back(error?.message);
}

export async function deleteDoc(fd: FormData) {
  const ctx = await requireOrg();
  const supabase = (await createClient());
  const { data } = await supabase.from("company_documents").select("storage_path").eq("id", String(fd.get("doc"))).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) back("not allowed");
  const { error } = await supabase.from("company_documents").delete().eq("id", String(fd.get("doc"))).eq("org_id", ctx.orgId);
  if (!error) await supabase.storage.from("company-docs").remove([data.storage_path]);
  back(error?.message);
}
