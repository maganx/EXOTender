import Link from "next/link";
import { requestPasswordReset, resendConfirmation, signIn, signUp } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import { friendlyError, getT } from "@/lib/i18n";

export default async function LoginPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const { t } = (await getT());
  const signup = searchParams.mode === "signup";
  const next = searchParams.next ?? "/app";
  const email = searchParams.email ?? "";
  const q = (m?: string) => `/login?${m ? "mode=" + m + "&" : ""}next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
  if (searchParams.mode === "forgot")
    return (
      <AuthShell back="/login?mode=forgot">
        <h1>{t("forgot_t")}</h1>
        <p>{t("forgot_s")}</p>
        {searchParams.msg && <div className="err">{friendlyError(searchParams.msg, t)}</div>}
        {searchParams.sent && <div className="ok">{t("forgot_sent")}</div>}
        <form action={requestPasswordReset} className="fields" style={{ gridTemplateColumns: "1fr" }}>
          <div className="fld">
            <label htmlFor="email">{t("email")}</label>
            <input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
          </div>
          <button className="btn gold" type="submit" style={{ justifyContent: "center" }}>
            {t("forgot_send")}
          </button>
        </form>
        <Link href={q()} style={{ fontSize: 13.5, color: "var(--gold-strong)" }}>
          {t("signin")}
        </Link>
      </AuthShell>
    );
  return (
    <AuthShell back={q(signup ? "signup" : undefined)}>
      <h1>{signup ? t("signup") : t("login_t")}</h1>
      <p>{t("login_s")}</p>
      {searchParams.error && <div className="err">{t("badLogin")}</div>}
      {searchParams.msg && <div className="err">{friendlyError(searchParams.msg, t)}</div>}
      {searchParams.sent && <div className="ok">{t("checkEmail")}</div>}
      {(searchParams.unconfirmed || searchParams.expired) && (
        <>
          <div className="err">{searchParams.unconfirmed ? t("unconfirmed") : t("expiredLink")}</div>
          <form action={resendConfirmation} className="inline">
            <input type="hidden" name="next" value={next} />
            <input className="mini" name="email" type="email" required defaultValue={searchParams.email ?? ""} placeholder={t("email")} aria-label={t("email")} />
            <button className="btn sm" type="submit">{t("resend")}</button>
          </form>
        </>
      )}
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
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
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
      {!signup && (
        <Link href={q("forgot")} style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {t("forgot")}
        </Link>
      )}
    </AuthShell>
  );
}
