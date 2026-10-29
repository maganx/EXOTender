import { setTheme } from "@/app/actions";
import { getT, getTheme } from "@/lib/i18n";
import { headers } from "next/headers";

export async function ThemeSwitch({ back }: { back: string }) {
  const theme = await getTheme();
  const { t } = await getT();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <form action={setTheme} className="inline-form">
      <input type="hidden" name="theme" value={next} />
      <input type="hidden" name="back" value={(await headers()).get("x-url") ?? back} />
      <button className="lang" type="submit" aria-label={t(`theme_${next}`)} title={t(`theme_${next}`)}>
        {next === "dark" ? "☾" : "☀"}
      </button>
    </form>
  );
}
