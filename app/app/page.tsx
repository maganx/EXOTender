import Link from "next/link";
import { DueChip, Kpi, StageTag } from "@/components/bits";
import { ACTIVE, STAGES, WON, canSeeMoney, daysUntil, fmtDate, money, nextAction, type Stage } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { loadTenders, requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

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

  type Item = { key: string; href: string; title: string; text: string; due: string | null; n: number | null; stage?: Stage };
  const items: Item[] = [];
  for (const x of active) {
    const na = nextAction(x, x.summary, t, lang);
    if (na) items.push({ key: x.id, href: `/app/tenders/${x.id}`, title: x.title || x.tender_no, text: `${na.text} · ${x.entity ?? ""}`, due: na.due, n: daysUntil(na.due), stage: x.stage });
  }
  for (const x of all) {
    if (x.summary.psSubmitted && x.summary.psExpiry && has(WON, x.stage) && x.stage !== "closed") {
      const n = daysUntil(x.summary.psExpiry);
      if (n != null && n <= 30)
        items.push({ key: x.id + "ps", href: `/app/tenders/${x.id}?tab=contract`, title: x.title || x.tender_no, text: `${t("ps_h")}: ${t("f_psExp").toLowerCase()} ${fmtDate(x.summary.psExpiry, lang)}`, due: x.summary.psExpiry, n });
    }
  }
  // BRELA, tax clearance and other company papers that run out soon are needed for every bid
  const { data: papers } = await (await createClient())
    .from("company_documents")
    .select("id, title, expires_on")
    .eq("org_id", ctx.orgId)
    .not("expires_on", "is", null);
  for (const d of papers ?? []) {
    const n = daysUntil(d.expires_on);
    if (n != null && n <= 30)
      items.push({ key: d.id, href: "/app/documents", title: d.title, text: t("doc_expiring", { d: fmtDate(d.expires_on, lang) }), due: d.expires_on, n });
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
              items.slice(0, 12).map((i) => (
                <Link key={i.key} className="arow" href={i.href} style={{ textDecoration: "none" }}>
                  <span className={`dot ${i.n == null ? "" : i.n <= 3 ? "bad" : i.n <= 7 ? "warn" : "ok"}`} />
                  <span style={{ minWidth: 0 }}>
                    <div className="at">{i.title}</div>
                    <div className="am">{i.text}</div>
                  </span>
                  <span>{i.due ? <DueChip date={i.due} t={t} /> : i.stage ? <StageTag stage={i.stage} t={t} /> : null}</span>
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
