import Link from "next/link";
import { addFromNest, saveKeywords } from "./actions";
import { DueChip } from "@/components/bits";
import { canEdit, daysUntil, fmtDate, fromLocalInput, isAdmin } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { DEFAULT_KEYWORDS, fetchPublished, matcher, type NestTender } from "@/lib/nest";
import { requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

const PER_PAGE = 25;

export default async function NestPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const supabase = await createClient();
  const showAll = searchParams.all === "1";
  const q = (searchParams.q ?? "").trim();

  const [{ data: org }, { data: have }, nest] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", ctx.orgId).single(),
    supabase.from("tenders").select("tender_no").eq("org_id", ctx.orgId),
    fetchPublished().then(
      (list) => ({ list, failed: false }),
      () => ({ list: [] as NestTender[], failed: true }),
    ),
  ]);
  const saved = (org?.settings as { nest_keywords?: string[] } | null)?.nest_keywords;
  const keywords = saved?.length ? saved : DEFAULT_KEYWORDS;

  const match = matcher(keywords);
  const search = q ? matcher(q.split(/\s+/)) : null;
  const open = nest.list
    .filter((x) => {
      const n = daysUntil(fromLocalInput(x.deadline ?? ""));
      return n != null && n >= 0;
    })
    .filter((x) => showAll || match(x))
    .filter((x) => !search || search(x) || `${x.no} ${x.entity}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  const pages = Math.max(1, Math.ceil(open.length / PER_PAGE));
  const pg = Math.min(pages, Math.max(1, Number(searchParams.p) || 1));
  const shown = open.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);
  const href = (p: number, all = showAll) =>
    `/app/nest?${new URLSearchParams({ ...(all ? { all: "1" } : {}), ...(q ? { q } : {}), ...(p > 1 ? { p: String(p) } : {}) })}`;

  const added = new Set((have ?? []).map((r) => r.tender_no));
  const edit = canEdit(ctx.role);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("nest_t")}</h1>
          <p>{t("nest_s")}</p>
        </div>
        <Link className="btn" href={href(1, !showAll)}>
          {showAll ? t("nest_mine") : t("nest_all")}
        </Link>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      {searchParams.added && <div className="ok">{t("nest_done", { n: searchParams.added })}</div>}

      {isAdmin(ctx.role) && (
        <details className="sec">
          <summary className="sum">
            {t("nest_kw")} <span className="am">({keywords.length})</span>
          </summary>
          <form action={saveKeywords} className="fld" style={{ marginTop: 10 }}>
            <textarea id="keywords" name="keywords" aria-label={t("nest_kw")} defaultValue={keywords.join(", ")} style={{ minHeight: 64 }} />
            <span className="am" style={{ whiteSpace: "normal" }}>{t("nest_kwHint")}</span>
            <div className="actions">
              <button className="btn" type="submit">{t("save")}</button>
            </div>
          </form>
        </details>
      )}

      {nest.failed ? (
        <div className="err">{t("nest_fail")}</div>
      ) : (
        <>
          <form className="filters" action="/app/nest">
            {showAll && <input type="hidden" name="all" value="1" />}
            <input type="search" name="q" defaultValue={q} placeholder={t("nest_search")} aria-label={t("nest_search")} />
            <button className="btn" type="submit">{t("nest_go")}</button>
          </form>
          <form action={addFromNest} className="page">
            <div className="nest-bar">
              <span className="chip">{t("nest_found", { n: open.length })}</span>
              {edit && shown.length > 0 && (
                <button className="btn gold" type="submit">{t("nest_add")}</button>
              )}
            </div>
            {shown.length ? (
              <ul className="nest-list">
                {shown.map((x) => {
                  const done = added.has(x.no);
                  const due = fromLocalInput(x.deadline ?? "");
                  return (
                    <li key={x.no}>
                      <label className={`nest-item${done ? " done" : ""}`}>
                        {done ? (
                          <span className="chip ok" title={t("nest_added")}>✓</span>
                        ) : (
                          <input type="checkbox" name="pick" value={x.no} disabled={!edit} />
                        )}
                        <span className="nest-main">
                          <span className="nest-title">{x.title}</span>
                          <span className="am">{x.entity}</span>
                          <span className="nest-meta">
                            <span className="num">{x.no}</span>
                            {x.method && <span>{x.method}</span>}
                            {x.lots > 1 && <span>{t("lots")}: {x.lots}</span>}
                          </span>
                        </span>
                        <span className="nest-due num">
                          <DueChip date={due} t={t} />
                          <span className="am">{fmtDate(due, lang, true)}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="sec empty">{t("nest_none")}</div>
            )}
            {pages > 1 && (
              <nav className="pager" aria-label={t("nest_pages")}>
                {pg > 1 ? <Link className="btn sm" href={href(pg - 1)}>‹ {t("nest_prev")}</Link> : <span />}
                <span className="am">{t("nest_pageOf", { p: pg, n: pages })}</span>
                {pg < pages ? <Link className="btn sm" href={href(pg + 1)}>{t("nest_next")} ›</Link> : <span />}
              </nav>
            )}
          </form>
        </>
      )}
    </>
  );
}
