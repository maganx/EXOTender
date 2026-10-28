import { createOrganization } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/lib/i18n";

export default function Onboarding({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { t } = getT();
  return (
    <AuthShell back="/onboarding">
      <h1>{t("onb_t")}</h1>
      <p>{t("onb_s")}</p>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      <form action={createOrganization} className="fields" style={{ gridTemplateColumns: "1fr" }}>
        <div className="fld">
          <label htmlFor="name">{t("orgName")}</label>
          <input id="name" name="name" required minLength={2} maxLength={160} />
        </div>
        <div className="fld">
          <label htmlFor="tin">{t("orgTin")}</label>
          <input id="tin" name="tin" inputMode="numeric" />
        </div>
        <button className="btn gold" type="submit" style={{ justifyContent: "center" }}>
          {t("createOrg")}
        </button>
      </form>
    </AuthShell>
  );
}
