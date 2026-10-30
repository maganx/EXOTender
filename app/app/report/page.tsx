import { Kpi } from "@/components/bits";
import { PrintButton } from "@/components/PrintButton";
import { MON, WON, canSeeMoney, money, type Stage } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { one, requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

const MONTHS = 6;
const EAT_OFFSET = 3 * 60 * 60 * 1000;

/** YYYY-MM of a date or timestamp, in East Africa Time */
function monthOf(s: string | null | undefined) {
  if (!s) return null;
  if (s.length === 10) return s.slice(0, 7);
  const d = new Date(s);
  return isNaN(+d) ? null : new Date(+d + EAT_OFFSET).toISOString().slice(0, 7);
}
function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) + "%" : "—");

type Row = {
  stage: Stage;
  deadline: string | null;
  tender_pricing: unknown;
  tender_contracts: unknown;
  deliveries: { delivery_date: string | null; status: string }[] | null;
  invoices: { invoice_date: string | null; amount: number; paid: number; paid_on: string | null }[] | null;
};
type Month = {
  m: string;
  submitted: number;
  won: number;
  wonValue: number;
  invoiced: number;
  received: number;
  marginNum: number;
  marginDen: number;
  delivered: number;
  onTime: number;
  payDays: number[];
};

export default async function MonthlyReport(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const showMoney = canSeeMoney(ctx.role);

  const thisMonth = new Date(Date.now() + EAT_OFFSET).toISOString().slice(0, 7);
  const sel = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? searchParams.m! : thisMonth;
  const keys = Array.from({ length: MONTHS }, (_, i) => shiftMonth(sel, i - MONTHS + 1));
  const months = new Map<string, Month>(
    keys.map((m) => [m, { m, submitted: 0, won: 0, wonValue: 0, invoiced: 0, received: 0, marginNum: 0, marginDen: 0, delivered: 0, onTime: 0, payDays: [] }]),
  );
  const at = (s: string | null | undefined) => {
    const k = monthOf(s);
    return k ? months.get(k) : undefined;
  };

  const { data, error } = await (await createClient())
    .from("tenders")
    .select(
      "stage, deadline, tender_pricing(cost, transport, other, bid_price), tender_contracts(award_date, award_amount, contract_value, end_date), deliveries(delivery_date, status), invoices(invoice_date, amount, paid, paid_on)",
    )
    .eq("org_id", ctx.orgId);
  if (error) throw error;

  let outstanding = 0;
  let winWon = 0;
  let winLost = 0;
  for (const r of (data ?? []) as Row[]) {
    const p = one<{ cost: number | null; transport: number | null; other: number | null; bid_price: number | null }>(r.tender_pricing);
    const c = one<{ award_date: string | null; award_amount: number | null; contract_value: number | null; end_date: string | null }>(r.tender_contracts);
    const bid = Number(p?.bid_price || 0);
    const won = (WON as readonly string[]).includes(r.stage);
    // a lost tender with no bid price was a no-bid, not a bid we lost
    const bidMade = won || r.stage === "submitted" || r.stage === "eval" || (r.stage === "lost" && bid > 0);

    const dm = at(r.deadline);
    if (dm && bidMade) {
      dm.submitted++;
      if (won) winWon++;
      else if (r.stage === "lost") winLost++;
    }
    const am = won ? at(c?.award_date) : undefined;
    if (am) {
      am.won++;
      am.wonValue += Number(c?.contract_value || 0) || Number(c?.award_amount || 0) || bid;
      const cost = Number(p?.cost || 0) + Number(p?.transport || 0) + Number(p?.other || 0);
      if (bid > 0 && cost > 0) {
        am.marginNum += bid - cost;
        am.marginDen += bid;
      }
    }
    for (const d of r.deliveries ?? []) {
      const m = d.status !== "planned" ? at(d.delivery_date) : undefined;
      if (!m) continue;
      m.delivered++;
      if (!c?.end_date || d.delivery_date! <= c.end_date) m.onTime++;
    }
    for (const i of r.invoices ?? []) {
      const amount = Number(i.amount || 0);
      const paid = Number(i.paid || 0);
      outstanding += Math.max(0, amount - paid);
      const im = at(i.invoice_date);
      if (im) im.invoiced += amount;
      const pm = at(i.paid_on);
      if (pm) {
        pm.received += paid;
        if (i.invoice_date && paid >= amount) pm.payDays.push(days(i.invoice_date, i.paid_on!));
      }
    }
  }

  const cur = months.get(sel)!;
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const margin = (m: Month) => pct(m.marginNum, m.marginDen);
  const label = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return `${MON[lang][mo - 1]} ${y}`;
  };
  const curPay = avg(cur.payDays);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("rep_t", { m: label(sel) })}</h1>
          <p>
            {ctx.orgName} · {t("rep_s")}
          </p>
        </div>
        <form className="filters no-print" method="get" style={{ marginBottom: 0 }}>
          <input type="month" name="m" defaultValue={sel} aria-label={t("rep_month")} style={{ flex: "0 1 170px" }} />
          <button className="btn" type="submit">
            {t("rep_show")}
          </button>
          <PrintButton>{t("rep_print")}</PrintButton>
        </form>
      </div>
      <div className="kpis">
        <Kpi label={t("rep_submitted")} value={cur.submitted} sub={t("rep_byDeadline")} />
        <Kpi label={t("rep_won")} value={showMoney ? money(cur.wonValue, true) : cur.won} sub={t("rep_wonSub", { n: cur.won })} />
        <Kpi label={t("rep_winRate")} value={pct(winWon, winWon + winLost)} sub={t("rep_lastN", { n: MONTHS })} />
        {showMoney && <Kpi label={t("rep_invoiced")} value={money(cur.invoiced, true)} sub={t("rep_thisMonth")} />}
        {showMoney && <Kpi label={t("rep_received")} value={money(cur.received, true)} sub={t("rep_thisMonth")} />}
        {showMoney && <Kpi label={t("rep_margin")} value={margin(cur)} sub={t("rep_marginSub")} />}
        <Kpi label={t("rep_onTime")} value={pct(cur.onTime, cur.delivered)} sub={t("rep_delivSub", { n: cur.delivered })} />
        {showMoney && <Kpi label={t("rep_payDays")} value={curPay ?? "—"} sub={t("rep_payDaysSub")} hot={curPay != null && curPay > 60} />}
        {showMoney && <Kpi label={t("k_recv")} value={money(outstanding, true)} sub={t("rep_now")} hot={outstanding > 0} />}
      </div>
      <section className="panel-box">
        <h2>{t("rep_trend", { n: MONTHS })}</h2>
        <div className="tbl-wrap" style={{ border: 0 }}>
          <table style={{ minWidth: showMoney ? 760 : 420 }}>
            <thead>
              <tr>
                <th>{t("rep_month")}</th>
                <th className="r">{t("rep_submitted")}</th>
                <th className="r">{t("rep_wonN")}</th>
                {showMoney && <th className="r">{t("rep_wonV")}</th>}
                {showMoney && <th className="r">{t("rep_invoiced")}</th>}
                {showMoney && <th className="r">{t("rep_received")}</th>}
                {showMoney && <th className="r">{t("rep_margin")}</th>}
                <th className="r">{t("rep_onTime")}</th>
                {showMoney && <th className="r">{t("rep_payDays")}</th>}
              </tr>
            </thead>
            <tbody>
              {[...months.values()].reverse().map((m) => (
                <tr key={m.m} style={{ cursor: "default", fontWeight: m.m === sel ? 700 : undefined }}>
                  <td>{label(m.m)}</td>
                  <td className="r num">{m.submitted}</td>
                  <td className="r num">{m.won}</td>
                  {showMoney && <td className="r num">{money(m.wonValue, true)}</td>}
                  {showMoney && <td className="r num">{money(m.invoiced, true)}</td>}
                  {showMoney && <td className="r num">{money(m.received, true)}</td>}
                  {showMoney && <td className="r num">{margin(m)}</td>}
                  <td className="r num">{pct(m.onTime, m.delivered)}</td>
                  {showMoney && <td className="r num">{avg(m.payDays) ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="empty" style={{ paddingBottom: 0, fontSize: 12.5 }}>
          {t("rep_note")}
        </p>
      </section>
    </>
  );
}
