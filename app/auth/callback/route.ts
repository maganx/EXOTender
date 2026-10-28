import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// email confirmation link lands here
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";
  if (!code || url.searchParams.get("error")) return NextResponse.redirect(new URL("/login?expired=1", url.origin));
  const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?expired=1", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
