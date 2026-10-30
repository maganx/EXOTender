import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { MON, WON, canSeeMoney, money, type Stage } from "@/lib/domain";
import { getT, translator } from "@/lib/i18n";
import { one, requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

const MONTHS = 6;
// longest period shown month by month in the table
const MAX_MONTHS = 24;
const EAT_OFFSET = 3 * 60 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of a date or timestamp, in East Africa Time */
function dayOf(s: string | null | undefined) {
  if (!s) return null;
  if (s.length === 10) return s;
  const d = new Date(s);
  return isNaN(+d) ? null : new Date(+d + EAT_OFFSET).toISOString().slice(0, 10);
}
function lastDay(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
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
  m?: string;
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

  const today = new Date(Date.now() + EAT_OFFSET).toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  // a period (from, to) when both dates are given, otherwise one month
  let from = DAY.test(searchParams.from ?? "") ? searchParams.from! : "";
  let to = DAY.test(searchParams.to ?? "") ? searchParams.to! : "";
  const isRange = !!(from && to);
  if (isRange && from > to) [from, to] = [to, from];
  const sel = isRange ? to.slice(0, 7) : /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? searchParams.m! : thisMonth;
  if (!isRange) {
    from = sel + "-01";
    to = lastDay(sel);
  }
  // the table shows the 6 months up to the chosen month, or each month of the period
  const span = isRange
    ? Math.min(MAX_MONTHS, (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + +to.slice(5, 7) - +from.slice(5, 7) + 1)
    : MONTHS;
  const keys = Array.from({ length: span }, (_, i) => shiftMonth(sel, i - span + 1));
  const blank = (m?: string): Month => ({ m, submitted: 0, won: 0, wonValue: 0, invoiced: 0, received: 0, marginNum: 0, marginDen: 0, delivered: 0, onTime: 0, payDays: [] });
  const months = new Map<string, Month>(keys.map((m) => [m, blank(m)]));
  const total = blank();
  /** the buckets a date counts in: its month row, and the totals when it falls in the period */
  const at = (s: string | null | undefined) => {
    const d = dayOf(s);
    if (!d) return [];
    const out: Month[] = [];
    const m = months.get(d.slice(0, 7));
    if (m && (!isRange || (d >= from && d <= to))) out.push(m);
    if (d >= from && d <= to) out.push(total);
    return out;
  };
  // win rate: over the period, or over the 6 months for a monthly report
  const inWinWindow = (s: string | null | undefined) => {
    const d = dayOf(s);
    return !!d && (isRange ? d >= from && d <= to : months.has(d.slice(0, 7)));
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

    if (bidMade) {
      for (const b of at(r.deadline)) b.submitted++;
      if (inWinWindow(r.deadline)) {
        if (won) winWon++;
        else if (r.stage === "lost") winLost++;
      }
    }
    if (won) {
      const cost = Number(p?.cost || 0) + Number(p?.transport || 0) + Number(p?.other || 0);
      for (const b of at(c?.award_date)) {
        b.won++;
        b.wonValue += Number(c?.contract_value || 0) || Number(c?.award_amount || 0) || bid;
        if (bid > 0 && cost > 0) {
          b.marginNum += bid - cost;
          b.marginDen += bid;
        }
      }
    }
    for (const d of r.deliveries ?? []) {
      if (d.status === "planned") continue;
      for (const b of at(d.delivery_date)) {
        b.delivered++;
        if (!c?.end_date || d.delivery_date! <= c.end_date) b.onTime++;
      }
    }
    for (const i of r.invoices ?? []) {
      const amount = Number(i.amount || 0);
      const paid = Number(i.paid || 0);
      outstanding += Math.max(0, amount - paid);
      for (const b of at(i.invoice_date)) b.invoiced += amount;
      for (const b of at(i.paid_on)) {
        b.received += paid;
        if (i.invoice_date && paid >= amount) b.payDays.push(days(i.invoice_date, i.paid_on!));
      }
    }
  }

  const cur = total;
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const margin = (m: Month) => pct(m.marginNum, m.marginDen);
  const label = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return `${MON[lang][mo - 1]} ${y}`;
  };
  const curPay = avg(cur.payDays);
  const fmtDay = (d: string) => `${+d.slice(8)} ${MON[lang][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
  const rangeView = isRange || searchParams.view === "range";
  const q0 = shiftMonth(thisMonth, -((+thisMonth.slice(5) - 1) % 3));
  const presets: { name: string; href: string; on: boolean }[] = [
    { name: t("rep_pMonth"), href: "/app/report", on: !isRange && sel === thisMonth },
    ...([
      [t("rep_pQuarter"), q0 + "-01"],
      [t("rep_pYear"), thisMonth.slice(0, 4) + "-01-01"],
      [t("rep_p12"), shiftMonth(thisMonth, -11) + "-01"],
    ] as const).map(([name, a]) => ({ name, href: `/app/report?from=${a}&to=${today}`, on: isRange && from === a && to === today })),
  ];
  const rows = [...months.values()];
  const wonV = showMoney ? money(cur.wonValue, true) : cur.won;
  const periodWord = t(isRange ? "rep_period" : "rep_thisMonth");

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{isRange ? t("rep_tRange", { a: fmtDay(from), b: fmtDay(to) }) : t("rep_t", { m: label(sel) })}</h1>
          <p>
            {ctx.orgName} · {t("rep_s")}
          </p>
        </div>
        <PrintButton className="btn gold">{t("rep_print")}</PrintButton>
      </div>

      <div className="rep-bar no-print">
        <nav className="rep-seg" aria-label={t("rep_viewMonth") + " / " + t("rep_viewRange")}>
          <Link href="/app/report" aria-current={rangeView ? undefined : "page"}>
            {t("rep_viewMonth")}
          </Link>
          <Link href="/app/report?view=range" aria-current={rangeView ? "page" : undefined}>
            {t("rep_viewRange")}
          </Link>
        </nav>
        {rangeView ? (
          <form className="rep-form" method="get">
            <label>
              <span>{t("rep_from")}</span>
              <input type="date" name="from" defaultValue={isRange ? from : thisMonth + "-01"} required />
            </label>
            <label>
              <span>{t("rep_to")}</span>
              <input type="date" name="to" defaultValue={isRange ? to : today} required />
            </label>
            <button className="btn" type="submit">
              {t("rep_show")}
            </button>
          </form>
        ) : (
          <form className="rep-form" method="get">
            <label>
              <span>{t("rep_month")}</span>
              <input type="month" name="m" defaultValue={sel} required />
            </label>
            <button className="btn" type="submit">
              {t("rep_show")}
            </button>
          </form>
        )}
        <div className="rep-chips">
          {presets.map((x) => (
            <Link key={x.name} href={x.href} aria-current={x.on ? "page" : undefined}>
              {x.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="rep-groups">
        <section className={`rep-group${showMoney ? "" : " wide"}`}>
          <h2>{t("rep_gBids")}</h2>
          <Stat label={t("rep_submitted")} value={cur.submitted} sub={t("rep_byDeadline")} />
          <Stat label={t("rep_won")} value={wonV} sub={t(isRange ? "rep_wonSubP" : "rep_wonSub", { n: cur.won })} />
          <Stat label={t("rep_winRate")} value={pct(winWon, winWon + winLost)} sub={isRange ? t("rep_winP") : t("rep_lastN", { n: MONTHS })} />
          {!showMoney && <Stat label={t("rep_onTime")} value={pct(cur.onTime, cur.delivered)} sub={t(isRange ? "rep_delivSubP" : "rep_delivSub", { n: cur.delivered })} />}
        </section>
        {showMoney && (
          <section className="rep-group gold">
            <h2>{t("rep_gMoney")}</h2>
            <Stat label={t("rep_invoiced")} value={money(cur.invoiced, true)} sub={periodWord} />
            <Stat label={t("rep_received")} value={money(cur.received, true)} sub={periodWord} />
            <Stat label={t("k_recv")} value={money(outstanding, true)} sub={t("rep_now")} hot={outstanding > 0} />
          </section>
        )}
        {showMoney && (
          <section className="rep-group">
            <h2>{t("rep_gOps")}</h2>
            <Stat label={t("rep_margin")} value={margin(cur)} sub={t("rep_marginSub")} />
            <Stat label={t("rep_onTime")} value={pct(cur.onTime, cur.delivered)} sub={t(isRange ? "rep_delivSubP" : "rep_delivSub", { n: cur.delivered })} />
            <Stat
              label={t("rep_payDays")}
              value={curPay == null ? "—" : t("rep_days", { n: curPay })}
              sub={t(isRange ? "rep_payDaysSubP" : "rep_payDaysSub")}
              hot={curPay != null && curPay > 60}
            />
          </section>
        )}
      </div>

      {showMoney && <Chart rows={rows} label={(m) => MON[lang][+m.slice(5) - 1]} year={(m) => m.slice(0, 4)} t={t} />}

      <section className="panel-box rep-table">
        <h2>{isRange ? t("rep_trendP") : t("rep_trend", { n: MONTHS })}</h2>
        <div className="tbl-wrap" style={{ border: 0 }}>
          <table style={{ minWidth: showMoney ? 820 : 420 }}>
            <thead>
              <tr>
                <th>{t("rep_month")}</th>
                <th className="r">{t("rep_cBids")}</th>
                <th className="r">{t("rep_wonN")}</th>
                {showMoney && <th className="r">{t("rep_cValue")}</th>}
                {showMoney && <th className="r">{t("rep_cInv")}</th>}
                {showMoney && <th className="r">{t("rep_cRec")}</th>}
                {showMoney && <th className="r">{t("rep_cMargin")}</th>}
                <th className="r">{t("rep_cOnTime")}</th>
                {showMoney && <th className="r">{t("rep_cDays")}</th>}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((m) => (
                <tr key={m.m} className={!isRange && m.m === sel ? "cur" : undefined}>
                  <td>{label(m.m!)}</td>
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
              {isRange && (
                <tr className="tot">
                  <td>{t("rep_total")}</td>
                  <td className="r num">{cur.submitted}</td>
                  <td className="r num">{cur.won}</td>
                  {showMoney && <td className="r num">{money(cur.wonValue, true)}</td>}
                  {showMoney && <td className="r num">{money(cur.invoiced, true)}</td>}
                  {showMoney && <td className="r num">{money(cur.received, true)}</td>}
                  {showMoney && <td className="r num">{margin(cur)}</td>}
                  <td className="r num">{pct(cur.onTime, cur.delivered)}</td>
                  {showMoney && <td className="r num">{curPay ?? "—"}</td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="rep-note">
          {t("rep_note")}
          {isRange && span === MAX_MONTHS ? " " + t("rep_maxNote", { n: MAX_MONTHS }) : ""}
        </p>
      </section>
    </>
  );
}

function Stat({ label, value, sub, hot }: { label: string; value: string | number; sub: string; hot?: boolean }) {
  return (
    <div className={`rep-stat${hot ? " hot" : ""}`}>
      <div>
        <div className="l">{label}</div>
        <div className="s">{sub}</div>
      </div>
      <div className="v num">{value}</div>
    </div>
  );
}

/** a round axis top: 1, 2, 2.5 or 5 times a power of ten, in four steps */
function niceTop(max: number) {
  if (max <= 0) return 4;
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw)!;
  return step * 4;
}

/** value won and payments received per month, as paired bars on one money axis */
function Chart({ rows, label, year, t }: { rows: Month[]; label: (m: string) => string; year: (m: string) => string; t: ReturnType<typeof translator> }) {
  const top = niceTop(Math.max(...rows.map((r) => Math.max(r.wonValue, r.received))));
  const h = (v: number) => `${(100 * v) / top}%`;
  return (
    <section className="panel-box rep-chart">
      <h2>
        {t("rep_chart")}
        <span className="rep-legend">
          <span>
            <i className="won" />
            {t("rep_wonV")}
          </span>
          <span>
            <i className="rec" />
            {t("rep_received")}
          </span>
        </span>
      </h2>
      <div className="rep-plot">
        <div className="rep-y">
          {[4, 3, 2, 1, 0].map((k) => (
            <span key={k} className="num">
              {k ? money((top * k) / 4, true).replace("TSh ", "") : "0"}
            </span>
          ))}
        </div>
        <div className="rep-cols">
          {[1, 2, 3, 4].map((k) => (
            <i key={k} className="grid" style={{ bottom: `${25 * k}%` }} />
          ))}
          {rows.map((r, i) => (
            <div key={r.m} className={`rep-col${i >= rows.length / 2 ? " r" : ""}`} tabIndex={0}>
              <div className="bars">
                <b className="won" style={{ height: h(r.wonValue) }} />
                <b className="rec" style={{ height: h(r.received) }} />
              </div>
              <div className="x">
                {label(r.m!)}
                {(i === 0 || r.m!.endsWith("-01")) && <small>{year(r.m!)}</small>}
              </div>
              <div className="tip" role="tooltip">
                <strong>
                  {label(r.m!)} {year(r.m!)}
                </strong>
                <span>
                  <i className="won" />
                  {t("rep_wonV")}: <b className="num">{money(r.wonValue, true)}</b>
                </span>
                <span>
                  <i className="rec" />
                  {t("rep_received")}: <b className="num">{money(r.received, true)}</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
