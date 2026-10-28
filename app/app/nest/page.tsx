import Link from "next/link";
import { addFromNest, saveKeywords } from "./actions";
import { DueChip } from "@/components/bits";
import { canEdit, daysUntil, fmtDate, fromLocalInput, isAdmin } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { DEFAULT_KEYWORDS, fetchPublished, matcher, type NestTender } from "@/lib/nest";
import { requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export default async function NestPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const supabase = await createClient();
  const showAll = searchParams.all === "1";

  const { data: org } = await supabase.from("organizations").select("settings").eq("id", ctx.orgId).single();
  const saved = (org?.settings as { nest_keywords?: string[] } | null)?.nest_keywords;
  const keywords = saved?.length ? saved : DEFAULT_KEYWORDS;

  let list: NestTender[] = [];
  let failed = false;
  try {
    list = await fetchPublished();
  } catch {
    failed = true;
  }
  const match = matcher(keywords);
  const open = list
    .filter((x) => {
      const n = daysUntil(fromLocalInput(x.deadline ?? ""));
      return n != null && n >= 0;
    })
    .filter((x) => showAll || match(x))
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  const { data: have } = await supabase.from("tenders").select("tender_no").eq("org_id", ctx.orgId);
  const added = new Set((have ?? []).map((r) => r.tender_no));
  const edit = canEdit(ctx.role);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("nest_t")}</h1>
          <p>{t("nest_s")}</p>
        </div>
        <Link className="btn" href={showAll ? "/app/nest" : "/app/nest?all=1"}>
          {showAll ? t("nest_mine") : t("nest_all")}
        </Link>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      {searchParams.added && <div className="ok">{t("nest_done", { n: searchParams.added })}</div>}

      {isAdmin(ctx.role) && (
        <form action={saveKeywords} className="sec">
          <div className="fld">
            <label htmlFor="keywords">{t("nest_kw")}</label>
            <textarea id="keywords" name="keywords" defaultValue={keywords.join(", ")} style={{ minHeight: 64 }} />
            <span className="am" style={{ whiteSpace: "normal" }}>{t("nest_kwHint")}</span>
          </div>
          <div className="actions">
            <button className="btn" type="submit">{t("save")}</button>
          </div>
        </form>
      )}

      {failed ? (
        <div className="err">{t("nest_fail")}</div>
      ) : (
        <form action={addFromNest} className="page">
          <div className="filters" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="chip">{t("nest_found", { n: open.length })}</span>
            {edit && open.length > 0 && (
              <button className="btn gold" type="submit">{t("nest_add")}</button>
            )}
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>{t("f_no")}</th>
                  <th>{t("f_title")}</th>
                  <th>{t("f_cat")}</th>
                  <th>{t("f_dead")}</th>
                </tr>
              </thead>
              <tbody>
                {open.length ? (
                  open.map((x) => {
                    const done = added.has(x.no);
                    return (
                      <tr key={x.no}>
                        <td>
                          {done ? (
                            <span className="chip ok" title={t("nest_added")}>✓</span>
                          ) : (
                            <input type="checkbox" name="pick" value={JSON.stringify(x)} aria-label={x.no} disabled={!edit} />
                          )}
                        </td>
                        <td className="num" style={{ fontSize: 12.5 }}>{x.no}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{x.title}</div>
                          <div className="am">
                            {x.entity}
                            {x.lots > 1 && ` · ${t("lots")}: ${x.lots}`}
                          </div>
                        </td>
                        <td className="am">{x.method}</td>
                        <td className="num">
                          {fmtDate(fromLocalInput(x.deadline ?? ""), lang, true)}
                          <br />
                          <DueChip date={fromLocalInput(x.deadline ?? "")} t={t} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="empty">{t("nest_none")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </>
  );
}
