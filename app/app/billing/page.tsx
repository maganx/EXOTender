import { checkSelcom, payWithSelcom, reportPayment } from "./actions";
import { canEditPayments, fmtDate, money } from "@/lib/domain";
import { getT, type Key } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { selcomConfigured } from "@/lib/selcom";

const METHODS = ["mpesa", "mixx", "airtel", "halopesa", "bank", "other"] as const;

export default async function Billing(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const supabase = await createClient();
  const canPay = canEditPayments(ctx.role);
  const [{ data: plans, error }, { data: info }, { data: pays }, { data: gateway }] = await Promise.all([
    supabase.from("plans").select("*").eq("active", true).order("sort"),
    supabase.from("platform_settings").select("value").eq("key", "pay_instructions").maybeSingle(),
    supabase.from("payments").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("gateway_ready"),
  ]);
  // Selcom shows once its keys are in Cloudflare and a platform admin has switched it on
  const selcom = canPay && selcomConfigured() && gateway === true;
  const open = selcom ? (pays ?? []).find(
        (p) => p.method === "selcom" && p.status === "pending" && (p.order_id === searchParams.order || Date.now() - Date.parse(p.created_at) < 90 * 60_000),
      ) : undefined;
  const sub = ctx.sub;
  const daysLeft = sub.endsAt ? Math.ceil((Date.parse(sub.endsAt) - Date.now()) / 86400000) : null;

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("bill_t")}</h1>
          <p>{t("bill_s")}</p>
        </div>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      {searchParams.sent && <div className="ok">{t("bill_sent")}</div>}
      {searchParams.paid && <div className="ok">{t("sel_paid")}</div>}
      {searchParams.closed && <div className="err">{t("sel_closed")}</div>}
      {error ? (
        <div className="notice">{t("bill_noSql")}</div>
      ) : (
        <>
          <section className={`sec substatus ${sub.active ? (daysLeft != null && daysLeft <= 5 ? "warn" : "ok") : "bad"}`}>
            <h3>{ctx.orgName}</h3>
            <p>
              {!sub.active
                ? t("bill_expired", { d: fmtDate(sub.endsAt, lang) })
                : sub.trial
                  ? t("bill_trial", { d: fmtDate(sub.endsAt, lang) })
                  : t("bill_active", { d: fmtDate(sub.endsAt, lang) })}
            </p>
          </section>

          <section className="sec">
            <h3>{t("bill_plans")}</h3>
            <div className="plans">
              {(plans ?? []).map((p) => (
                <div key={p.id} className="plan">
                  <b>{lang === "sw" ? p.name_sw : p.name_en}</b>
                  <span className="num">{money(p.price_tzs)}</span>
                  {p.months > 1 && <span className="am">{money(Math.round(p.price_tzs / p.months))} / {lang === "sw" ? "mwezi" : "month"}</span>}
                </div>
              ))}
            </div>
          </section>

          {selcom && (
            <section className="sec selcom">
              <h3>{t("sel_t")}</h3>
              {open ? (
                <>
                  <p className="payinfo">{t("sel_wait", { p: open.payer_phone ?? "" })}</p>
                  {searchParams.checked && <div className="notice">{t("sel_notyet")}</div>}
                  <form action={checkSelcom} className="actions">
                    <input type="hidden" name="order" value={open.order_id} />
                    <button className="btn gold" type="submit">{t("sel_check")}</button>
                    {open.gateway_url && (
                      <a className="btn" href={open.gateway_url} target="_blank" rel="noopener noreferrer">{t("sel_card")}</a>
                    )}
                  </form>
                </>
              ) : (
                <form action={payWithSelcom}>
                  <p className="payinfo">{t("sel_s")}</p>
                  <div className="fields">
                    <div className="fld">
                      <label htmlFor="sel-plan">{t("bill_plan")}</label>
                      <select id="sel-plan" name="plan" required>
                        {(plans ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {lang === "sw" ? p.name_sw : p.name_en} · {money(p.price_tzs)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fld">
                      <label htmlFor="sel-phone">{t("sel_phone")}</label>
                      <input id="sel-phone" name="phone" type="tel" inputMode="tel" required placeholder="0754 123 456" autoComplete="tel" />
                    </div>
                  </div>
                  <div className="actions">
                    <button className="btn gold" type="submit">{t("sel_go")}</button>
                  </div>
                </form>
              )}
            </section>
          )}

          <section className="sec">
            <h3>{selcom ? t("sel_or") : t("bill_how")}</h3>
            <p className="payinfo">{info?.value}</p>
            {canPay ? (
              <form action={reportPayment} style={{ marginTop: 12 }}>
                <h3 style={{ fontSize: 13 }}>{t("bill_report")}</h3>
                <div className="fields">
                  <div className="fld">
                    <label htmlFor="plan">{t("bill_plan")}</label>
                    <select id="plan" name="plan" required>
                      {(plans ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {lang === "sw" ? p.name_sw : p.name_en} · {money(p.price_tzs)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="fld">
                    <label htmlFor="method">{t("bill_method")}</label>
                    <select id="method" name="method">
                      {METHODS.map((m) => (
                        <option key={m} value={m}>{t(`m_${m}` as Key)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fld">
                    <label htmlFor="reference">{t("bill_ref")}</label>
                    <input id="reference" name="reference" required minLength={3} maxLength={100} />
                  </div>
                  <div className="fld">
                    <label htmlFor="phone">{t("bill_phone")}</label>
                    <input id="phone" name="phone" type="tel" inputMode="tel" />
                  </div>
                </div>
                <div className="actions">
                  <button className="btn gold" type="submit">{t("bill_send")}</button>
                </div>
              </form>
            ) : (
              <div className="notice" style={{ marginTop: 12 }}>{t("bill_only")}</div>
            )}
          </section>

          {canPay && (pays ?? []).length > 0 && (
            <section className="sec">
              <h3>{t("bill_hist")}</h3>
              <ul className="flist">
                {pays!.map((p) => (
                  <li key={p.id}>
                    <span className={`chip ${p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}`}>{t(`st_${p.status}` as Key)}</span>
                    <span className="fmain">
                      <b className="num">{money(p.amount_tzs)}</b>
                      <span className="am">
                        {t(`m_${p.method}` as Key)} · {p.reference} · {fmtDate(p.created_at, lang)}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
