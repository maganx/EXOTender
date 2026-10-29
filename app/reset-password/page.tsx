import { setNewPassword } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/lib/i18n";

// Reached from the password reset email, signed in by /auth/callback.
export default async function ResetPasswordPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const { t } = await getT();
  return (
    <AuthShell back="/reset-password">
      <h1>{t("newpw_t")}</h1>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      <form action={setNewPassword} className="fields" style={{ gridTemplateColumns: "1fr" }}>
        <div className="fld">
          <label htmlFor="password">{t("newpw")}</label>
          <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <button className="btn gold" type="submit" style={{ justifyContent: "center" }}>
          {t("save")}
        </button>
      </form>
    </AuthShell>
  );
}
