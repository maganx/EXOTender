import { redirect } from "next/navigation";
import { extendCompany, reviewPayment, savePayInfo } from "./actions";
import { fmtDate, money } from "@/lib/domain";
import { getT, type Key } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export default async function Admin(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  if (!ctx.platformAdmin) redirect("/app");
  const { t, lang } = await getT();
  const supabase = await createClient();
  const [{ data: pending }, { data: companies }, { data: info }] = await Promise.all([
    supabase.from("payments").select("*, organizations(name)").eq("status", "pending").order("created_at"),
    supabase.rpc("platform_companies"),
    supabase.from("platform_settings").select("value").eq("key", "pay_instructions").maybeSingle(),
  ]);
  const now = Date.now();

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("adm_t")}</h1>
          <p>{t("adm_s")}</p>
        </div>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}

      <section className="sec">
        <h3>{t("adm_pending")}</h3>
        {pending?.length ? (
          <ul className="flist">
            {pending.map((p) => (
              <li key={p.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span className="fmain">
                  <b>{(p.organizations as { name: string } | null)?.name} · {money(p.amount_tzs)}</b>
                  <span className="am">
                    {p.plan_id} · {t(`m_${p.method}` as Key)} · {p.reference}
                    {p.payer_phone ? ` · ${p.payer_phone}` : ""} · {fmtDate(p.created_at, lang, true)}
                  </span>
                </span>
                <form action={reviewPayment} className="inline">
                  <input type="hidden" name="payment" value={p.id} />
                  <input className="mini" name="note" placeholder={t("f_notes")} aria-label={t("f_notes")} style={{ maxWidth: 160 }} />
                  <button className="btn sm gold" type="submit" name="approve" value="1">{t("adm_approve")}</button>
                  <button className="btn sm danger" type="submit" name="approve" value="0">{t("adm_reject")}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{t("adm_none")}</p>
        )}
      </section>

      <section className="sec">
        <h3>{t("adm_companies")} <span className="chip">{companies?.length ?? 0}</span></h3>
        <ul className="flist">
          {(companies ?? []).map((c: { id: string; name: string; created_at: string; plan: string; trial_ends_at: string; paid_until: string | null; members: number; tenders: number; owner_email: string | null }) => {
            const ends = Math.max(Date.parse(c.trial_ends_at), c.paid_until ? Date.parse(c.paid_until) : 0);
            const live = ends > now;
            return (
              <li key={c.id} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                <span className={`chip ${live ? (c.paid_until && Date.parse(c.paid_until) > Date.parse(c.trial_ends_at) ? "ok" : "") : "bad"}`}>{c.plan}</span>
                <span className="fmain">
                  <b>{c.name}</b>
                  <span className="am">
                    {c.owner_email} · {t("c_members")}: {c.members} · {t("nav_tenders")}: {c.tenders} · {t("c_until")} {fmtDate(new Date(ends).toISOString(), lang)}
                  </span>
                </span>
                <form action={extendCompany} className="inline">
                  <input type="hidden" name="org" value={c.id} />
                  <input className="mini" name="days" type="number" min={1} max={730} defaultValue={30} aria-label={t("adm_extend")} style={{ width: 70 }} />
                  <button className="btn sm" type="submit">{t("adm_extend")}</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <form action={savePayInfo} className="sec">
        <div className="fld">
          <label htmlFor="payinfo">{t("adm_payinfo")}</label>
          <textarea id="payinfo" name="value" defaultValue={info?.value ?? ""} />
        </div>
        <div className="actions">
          <button className="btn gold" type="submit">{t("save")}</button>
        </div>
      </form>
    </>
  );
}
