import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// email confirmation link lands here
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";
  if (code) await createClient().auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next, url.origin));
}
