import Link from "next/link";
import { DueChip, StageTag } from "@/components/bits";
import { ACTIVE, canSeeMoney, fmtDate, money, nextAction } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { loadTenders, requireOrg } from "@/lib/org";

export default async function TenderList({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireOrg();
  const { t, lang } = getT();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const f = searchParams.f ?? "open";
  const isActive = (s: string) => (ACTIVE as readonly string[]).includes(s);
  const rows = (await loadTenders(ctx.orgId)).filter((x) => {
    if (f === "open" && !isActive(x.stage)) return false;
    if (f === "done" && isActive(x.stage)) return false;
    return !q || `${x.tender_no} ${x.title} ${x.entity ?? ""}`.toLowerCase().includes(q);
  });
  const showMoney = canSeeMoney(ctx.role);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("list_t")}</h1>
        </div>
      </div>
      <form className="filters" method="get">
        <input name="q" type="search" defaultValue={searchParams.q ?? ""} placeholder={t("search")} aria-label={t("search")} />
        <select name="f" defaultValue={f} aria-label={t("filter")}>
          <option value="open">{t("f_active")}</option>
          <option value="all">{t("f_all")}</option>
          <option value="done">{t("f_done")}</option>
        </select>
        <button className="btn" type="submit">
          {t("filter")}
        </button>
      </form>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("f_no")}</th>
              <th>{t("f_title")}</th>
              <th>{t("t_info")}</th>
              <th>{t("f_dead")}</th>
              {showMoney && <th className="r">{t("c_value")}</th>}
              <th>{t("c_next")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((x) => {
                const na = nextAction(x, x.summary, t, lang);
                return (
                  <tr key={x.id}>
                    <td className="num" style={{ fontSize: 12.5 }}>
                      <Link href={`/app/tenders/${x.id}`}>{x.tender_no}</Link>
                    </td>
                    <td>
                      <Link href={`/app/tenders/${x.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>
                        {x.title}
                      </Link>
                      {x.source === "nest" && x.stage === "found" && <span className="chip gold" style={{ marginLeft: 6 }}>NeST</span>}
                      <div className="am">{x.entity}</div>
                    </td>
                    <td>
                      <StageTag stage={x.stage} t={t} />
                    </td>
                    <td className="num">
                      {fmtDate(x.deadline, lang, true)}
                      {(x.stage === "found" || x.stage === "prep") && (
                        <>
                          <br />
                          <DueChip date={x.deadline} t={t} />
                        </>
                      )}
                    </td>
                    {showMoney && <td className="r num">{money(x.summary.value)}</td>}
                    <td>{na?.text ?? "—"}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="empty">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
