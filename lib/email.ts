import { serverEnv } from "./env";
import { emailHtml, escapeHtml } from "./email-layout";

// Emails the app sends itself (Supabase sends the account emails). Uses Resend's HTTP API:
// set RESEND_API_KEY and EMAIL_FROM (e.g. "Tenda Desk <tenda@yourdomain.co.tz>") as Worker secrets.

export const emailConfigured = () => Boolean(serverEnv("RESEND_API_KEY") && serverEnv("EMAIL_FROM"));

export async function sendEmail(m: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  const key = serverEnv("RESEND_API_KEY");
  const from = serverEnv("EMAIL_FROM");
  if (!key || !from) return { ok: false as const, error: "email not configured" };
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
  if (res.ok) return { ok: true as const };
  const body = await res.text();
  console.error("resend", res.status, body.slice(0, 300));
  let msg = body.slice(0, 200);
  try {
    msg = (JSON.parse(body) as { message?: string }).message ?? msg;
  } catch {}
  return { ok: false as const, error: msg };
}

export function inviteEmail(i: { site: string; link: string; org: string; inviter: string; role: string; roleEn: string; expires: string }) {
  const org = escapeHtml(i.org);
  const who = escapeHtml(i.inviter);
  const subject = `${i.inviter} amekualika kwenye ${i.org} · Tenda Desk`;
  const html = emailHtml({
    site: i.site,
    preheader: `Jiunge na ${org} kwenye Tenda Desk kama ${escapeHtml(i.role)}.`,
    title: `Umealikwa kujiunga na ${org}`,
    paragraphs: [
      `Habari, <b>${who}</b> amekualika kujiunga na timu ya <b>${org}</b> kwenye Tenda Desk, mfumo wa kusimamia tenda za serikali kuanzia NeST hadi malipo.`,
      `Nafasi yako: <b>${escapeHtml(i.role)}</b>.`,
      `Bofya kitufe hapa chini. Kama huna akaunti, fungua akaunti kwa <b>barua pepe hii hii</b>, kisha ukubali mwaliko.`,
    ],
    button: { label: "Kubali mwaliko", url: i.link },
    note: `Mwaliko huu unaisha ${escapeHtml(i.expires)}. Kama hukutarajia barua hii, unaweza kuipuuza.`,
    other: `${who} invited you to join ${org} on Tenda Desk as ${escapeHtml(i.roleEn)}. Use the button above and sign up with this same email.`,
  });
  const text = [
    `Umealikwa kujiunga na ${i.org} kwenye Tenda Desk.`,
    `${i.inviter} amekualika kama ${i.role}.`,
    `Fungua link hii na utumie barua pepe hii hii: ${i.link}`,
    `Mwaliko unaisha ${i.expires}.`,
    "",
    `${i.inviter} invited you to join ${i.org} on Tenda Desk as ${i.roleEn}: ${i.link}`,
  ].join("\n");
  return { subject, html, text };
}
