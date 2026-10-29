import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/auth", "/invite", "/api/selcom/"];

export async function updateSession(request: NextRequest) {
  // pages read the path to decide what an expired subscription may still open
  request.headers.set("x-path", request.nextUrl.pathname);
  // the language and theme switches return to the page the person was on
  const here = request.nextUrl.clone();
  for (const k of ["msg", "ok", "saved", "sent", "paid", "closed", "added", "checked", "nomail", "error"]) here.searchParams.delete(k);
  request.headers.set("x-url", here.pathname + here.search);
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Supabase sends failed email links back to the site root with error params
  if (request.nextUrl.searchParams.get("error_code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?expired=1";
    return NextResponse.redirect(url);
  }
  if (!user && path !== "/" && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}
