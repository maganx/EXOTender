import Link from "next/link";
import { signIn, signUp } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/lib/i18n";

export default async function LoginPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const { t } = (await getT());
  const signup = searchParams.mode === "signup";
  const next = searchParams.next ?? "/app";
  const q = (m?: string) => `/login?${m ? "mode=" + m + "&" : ""}next=${encodeURIComponent(next)}`;
  return (
    <AuthShell back={q(signup ? "signup" : undefined)}>
      <h1>{signup ? t("signup") : t("login_t")}</h1>
      <p>{t("login_s")}</p>
      {searchParams.error && <div className="err">{t("badLogin")}</div>}
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      {searchParams.sent && <div className="ok">{t("checkEmail")}</div>}
      <form action={signup ? signUp : signIn} className="fields" style={{ gridTemplateColumns: "1fr" }}>
        <input type="hidden" name="next" value={next} />
        {signup && (
          <div className="fld">
            <label htmlFor="full_name">{t("fullName")}</label>
            <input id="full_name" name="full_name" autoComplete="name" required />
          </div>
        )}
        <div className="fld">
          <label htmlFor="email">{t("email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="fld">
          <label htmlFor="password">{t("password")}</label>
          <input id="password" name="password" type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required />
        </div>
        <button className="btn gold" type="submit" style={{ justifyContent: "center" }}>
          {signup ? t("signup") : t("signin")}
        </button>
      </form>
      <Link href={signup ? q() : q("signup")} style={{ fontSize: 13.5, color: "var(--gold-strong)" }}>
        {signup ? t("haveAcc") : t("noAcc")}
      </Link>
    </AuthShell>
  );
}
