// Branded HTML for every email Tenda Desk sends: built from tables and inline styles,
// which is what Gmail, Outlook and phone mail apps render reliably. No imports, so the
// Supabase template script can load it directly with Node.

export type EmailParts = {
  /** Base address of the site, used for the logo image. Supabase templates pass "{{ .SiteURL }}". */
  site: string;
  /** Hidden preview text shown next to the subject in the inbox. */
  preheader: string;
  title: string;
  /** Paragraphs; may contain <b> and links. */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Small print under the button, e.g. "the link expires in 7 days". */
  note?: string;
  /** One line in the other language, for people who read English (or Swahili). */
  other?: string;
};

const NAVY = "#13285C";
const NIGHT = "#0B1736";
const GOLD = "#C9A86A";
const INK = "#1B2540";
const MUTED = "#5B6683";
const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function emailHtml(p: EmailParts) {
  const para = (t: string) => `<p style="margin:0 0 14px;font:400 15px/1.6 ${FONT};color:${INK}">${t}</p>`;
  const button = p.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px"><tr>
        <td bgcolor="${GOLD}" style="border-radius:10px">
          <a href="${p.button.url}" target="_blank" style="display:inline-block;padding:14px 28px;font:700 15px ${FONT};color:${NIGHT};text-decoration:none;border-radius:10px">${p.button.label}</a>
        </td></tr></table>
      <p style="margin:12px 0 0;font:400 12px/1.5 ${FONT};color:${MUTED}">Kama kitufe hakifunguki, nakili link hii kwenye browser:<br>
        <a href="${p.button.url}" style="color:${NAVY};word-break:break-all">${p.button.url}</a></p>`
    : "";
  return `<!doctype html>
<html lang="sw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${p.title}</title></head>
<body style="margin:0;padding:0;background:#EEF1F7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${p.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF1F7"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:16px 16px 0 0;padding:22px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><img src="${p.site}/email/exo-logo.png" width="92" height="35" alt="EXO" style="display:block;border:0"></td>
        <td align="right" style="font:700 12px ${FONT};letter-spacing:2px;color:${GOLD};text-transform:uppercase">Tenda Desk</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="${GOLD}" style="height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>
    <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;padding:30px 28px 26px;border-radius:0 0 16px 16px">
      <h1 style="margin:0 0 16px;font:800 22px/1.3 ${FONT};color:${NAVY}">${p.title}</h1>
      ${p.paragraphs.map(para).join("\n      ")}
      ${button}
      ${p.note ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #E4E8F1;font:400 13px/1.5 ${FONT};color:${MUTED}">${p.note}</p>` : ""}
      ${p.other ? `<p style="margin:10px 0 0;font:italic 400 13px/1.5 ${FONT};color:${MUTED}">${p.other}</p>` : ""}
    </td></tr>
    <tr><td align="center" style="padding:22px 16px 8px;font:400 12px/1.6 ${FONT};color:${MUTED}">
      <b style="color:${NAVY}">Tenda Desk</b> ni huduma ya EXO Global Company Limited<br>
      Natai Plaza, 17 Mikocheni, Coca Cola Rd, Mwenge, Dar es Salaam<br>
      +255 718 367 093 · <a href="mailto:exoglobal@gmail.com" style="color:${MUTED}">exoglobal@gmail.com</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
