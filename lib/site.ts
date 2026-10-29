import { headers } from "next/headers";

/**
 * The address people reached the app on, so links in emails and invitations always open the same site.
 * Falls back to NEXT_PUBLIC_SITE_URL only when there is no request (never the other way round,
 * because a stale build setting sent invitees to the wrong place).
 */
export async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
    return `${proto.split(",")[0].trim()}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}
