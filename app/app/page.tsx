import Link from "next/link";
import { DueChip, Kpi, StageTag } from "@/components/bits";
import { ACTIVE, STAGES, WON, canSeeMoney, daysUntil, fmtDate, money, nextAction, type Stage } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { loadTenders, requireOrg } from "@/lib/org";

const has = (list: readonly string[], s: string) => list.includes(s);

export default async function Overview() {
  const ctx = await requireOrg();
  const { t, lang } = (await getT());
  const all = await loadTenders(ctx.orgId);
  const money_ = canSeeMoney(ctx.role);

  const head = (
    <div className="view-head">
      <div>
        <h1>{t("over_t")}</h1>
        <p>{t("over_s")}</p>
      </div>
    </div>
  );
  if (!all.length)
    return (
      <>
        {head}
        <div className="panel-box">
          <p className="empty">{t("empty_all")}</p>
        </div>
      </>
    );

  const active = all.filter((x) => has(ACTIVE, x.stage));
  const due7 = all.filter((x) => (x.stage === "found" || x.stage === "prep") && (() => { const n = daysUntil(x.deadline); return n != null && n >= 0 && n <= 7; })());
  const waiting = all.filter((x) => x.stage === "submitted" || x.stage === "eval");
  const won = all.filter((x) => has(WON, x.stage));
  const lost = all.filter((x) => x.stage === "lost");
  const rate = won.length + lost.length ? Math.round((100 * won.length) / (won.length + lost.length)) + "%" : "—";
  const out = all.reduce((a, x) => a + x.summary.outstanding, 0);

  const items = active
    .map((x) => ({ x, na: nextAction(x, x.summary, t, lang) }))
    .filter((i) => i.na)
    .map((i) => ({ ...i, n: daysUntil(i.na!.due) }));
  for (const x of all) {
    if (x.summary.psSubmitted && x.summary.psExpiry && has(WON, x.stage) && x.stage !== "closed") {
      const n = daysUntil(x.summary.psExpiry);
      if (n != null && n <= 30) items.push({ x, na: { text: `${t("ps_h")}: ${t("f_psExp").toLowerCase()} ${fmtDate(x.summary.psExpiry, lang)}`, due: x.summary.psExpiry }, n });
    }
  }
  items.sort((a, b) => (a.n ?? 9999) - (b.n ?? 9999));

  const stages: Stage[] = [...STAGES, "lost"];
  const counts = stages.map((s) => [s, all.filter((x) => x.stage === s).length] as const);
  const mx = Math.max(1, ...counts.map((c) => c[1]));

  return (
    <>
      {head}
      <div className="kpis">
        <Kpi label={t("k_active")} value={active.length} sub={t("nav_tenders").toLowerCase()} />
        <Kpi label={t("k_due")} value={due7.length} sub={t("s_prep").toLowerCase()} hot={due7.length > 0} />
        <Kpi label={t("k_wait")} value={waiting.length} sub={money_ ? money(waiting.reduce((a, x) => a + x.summary.bid, 0), true) : ""} />
        <Kpi label={t("k_won")} value={money_ ? money(won.reduce((a, x) => a + x.summary.value, 0), true) : won.length} sub={`${won.length} · ${rate} ${t("winRate")}`} />
        {money_ && <Kpi label={t("k_recv")} value={money(out, true)} sub={t("outstanding").toLowerCase()} />}
      </div>
      <div className="grid2">
        <section className="panel-box">
          <h2>{t("needs")}</h2>
          <div className="alist">
            {items.length ? (
              items.slice(0, 12).map(({ x, na, n }, i) => (
                <Link key={x.id + i} className="arow" href={`/app/tenders/${x.id}`} style={{ textDecoration: "none" }}>
                  <span className={`dot ${n == null ? "" : n <= 3 ? "bad" : n <= 7 ? "warn" : "ok"}`} />
                  <span style={{ minWidth: 0 }}>
                    <div className="at">{x.title || x.tender_no}</div>
                    <div className="am">
                      {na!.text} · {x.entity}
                    </div>
                  </span>
                  <span>{na!.due ? <DueChip date={na!.due} t={t} /> : <StageTag stage={x.stage} t={t} />}</span>
                </Link>
              ))
            ) : (
              <p className="empty">{t("none_action")}</p>
            )}
          </div>
        </section>
        <section className="panel-box">
          <h2>{t("pipeline")}</h2>
          <div className="pipe">
            {counts.map(([s, c]) => (
              <div key={s} className={`pipe-row ${has(WON, s) ? "won" : ""}`}>
                <span>{t(`s_${s}`)}</span>
                <span className="bar">
                  <i style={{ width: `${(c / mx) * 100}%` }} />
                </span>
                <span className="num">{c}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
