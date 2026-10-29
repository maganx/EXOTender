// Writes the Supabase account email templates (Authentication -> Emails -> Templates) from the
// same layout the app uses for its own emails. Run: node --experimental-strip-types scripts/email-templates.mjs
import { writeFileSync } from "node:fs";
import { emailHtml } from "../lib/email-layout.ts";

const site = "{{ .SiteURL }}";
const link = (type, next) =>
  `${site}/auth/callback?token_hash={{ .TokenHash }}&type=${type}` + (next ? `&next=${next}` : "&redirect_to={{ .RedirectTo }}");
const outro = "Kama hukuomba barua hii, unaweza kuipuuza. Akaunti yako iko salama.";

const templates = {
  "confirm-signup": {
    subject: "Thibitisha akaunti yako ya Tenda Desk",
    preheader: "Bofya kuthibitisha barua pepe yako na kuanza kutumia Tenda Desk.",
    title: "Karibu Tenda Desk",
    paragraphs: [
      "Asante kwa kufungua akaunti ya <b>Tenda Desk</b>, mfumo wa kusimamia tenda za serikali kuanzia NeST hadi malipo.",
      "Bofya kitufe hapa chini kuthibitisha barua pepe yako <b>{{ .Email }}</b>.",
    ],
    button: { label: "Thibitisha akaunti", url: link("email") },
    note: outro,
    other: "Welcome to Tenda Desk. Press the button above to confirm your email address.",
  },
  "reset-password": {
    subject: "Badilisha neno la siri la Tenda Desk",
    preheader: "Link ya kuweka neno jipya la siri.",
    title: "Badilisha neno la siri",
    paragraphs: ["Tumepokea ombi la kubadilisha neno la siri la akaunti <b>{{ .Email }}</b>.", "Bofya kitufe hapa chini kuweka neno jipya la siri."],
    button: { label: "Weka neno jipya", url: link("recovery", "/reset-password") },
    note: outro,
    other: "Someone asked to reset the password for this account. Press the button above to choose a new one.",
  },
  "magic-link": {
    subject: "Link yako ya kuingia Tenda Desk",
    preheader: "Bofya kuingia kwenye Tenda Desk.",
    title: "Ingia Tenda Desk",
    paragraphs: ["Bofya kitufe hapa chini kuingia kwenye akaunti yako <b>{{ .Email }}</b>."],
    button: { label: "Ingia", url: link("email", "/app") },
    note: outro,
    other: "Press the button above to sign in to Tenda Desk.",
  },
  "change-email": {
    subject: "Thibitisha barua pepe mpya",
    preheader: "Thibitisha kubadilisha barua pepe ya akaunti yako.",
    title: "Thibitisha barua pepe mpya",
    paragraphs: ["Umeomba kubadilisha barua pepe ya akaunti yako kutoka <b>{{ .Email }}</b> kwenda <b>{{ .NewEmail }}</b>.", "Bofya kitufe hapa chini kuthibitisha."],
    button: { label: "Thibitisha", url: link("email_change", "/app") },
    note: outro,
    other: "Press the button above to confirm your new email address.",
  },
  "invite-user": {
    subject: "Umealikwa kwenye Tenda Desk",
    preheader: "Kubali mwaliko na uweke neno la siri.",
    title: "Umealikwa kwenye Tenda Desk",
    paragraphs: ["Umealikwa kutumia <b>Tenda Desk</b>, mfumo wa kusimamia tenda za serikali kuanzia NeST hadi malipo.", "Bofya kitufe hapa chini, kisha weka neno lako la siri."],
    button: { label: "Kubali mwaliko", url: link("invite", "/reset-password") },
    note: "Kama hukutarajia barua hii, unaweza kuipuuza.",
    other: "You were invited to Tenda Desk. Press the button above, then choose your password.",
  },
};

const index = [];
for (const [name, p] of Object.entries(templates)) {
  writeFileSync(new URL(`../supabase/email-templates/${name}.html`, import.meta.url), emailHtml({ site, ...p }));
  index.push(`| ${name}.html | ${p.subject} |`);
}
console.log(index.join("\n"));
