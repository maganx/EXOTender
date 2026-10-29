import { setLang } from "@/app/actions";
import { getLang } from "@/lib/i18n";
import { headers } from "next/headers";

export async function LangSwitch({ back }: { back: string }) {
  const lang = (await getLang());
  return (
    <form action={setLang} className="inline-form">
      <input type="hidden" name="lang" value={lang === "sw" ? "en" : "sw"} />
      <input type="hidden" name="back" value={(await headers()).get("x-url") ?? back} />
      <button className="lang" type="submit" aria-label={lang === "sw" ? "Switch to English" : "Badili kwenda Kiswahili"}>
        {lang === "sw" ? "EN" : "SW"}
      </button>
    </form>
  );
}
