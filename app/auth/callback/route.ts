import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/** Same-site path to continue to: `next`, or the `next` inside the `redirect_to` an email template passes along. */
function nextPath(url: URL) {
  let next = url.searchParams.get("next");
  const via = url.searchParams.get("redirect_to");
  if (!next && via) {
    try {
      next = new URL(via).searchParams.get("next");
    } catch {}
  }
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

// Links in account emails land here. The token_hash form (used by our email templates) works on any
// device; the older ?code= form only works in the browser where the person signed up.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = nextPath(url);
  const fail = NextResponse.redirect(new URL("/login?expired=1", url.origin));
  if (url.searchParams.get("error")) return fail;
  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "";
  if (tokenHash && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    return error ? fail : NextResponse.redirect(new URL(next, url.origin));
  }
  const code = url.searchParams.get("code");
  if (!code) return fail;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? fail : NextResponse.redirect(new URL(next, url.origin));
}
