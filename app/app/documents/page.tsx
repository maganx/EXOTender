import { deleteDoc, uploadDoc } from "./actions";
import { STD_DOCS, canEdit, daysUntil, fmtDate, stdLabel } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export default async function Vault({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireOrg();
  const { t, lang } = getT();
  const supabase = createClient();
  const edit = canEdit(ctx.role);
  const { data: docs } = await supabase.from("company_documents").select("*").eq("org_id", ctx.orgId).order("kind");
  const signed = docs?.length
    ? (await supabase.storage.from("company-docs").createSignedUrls(docs.map((d) => d.storage_path), 60 * 10)).data ?? []
    : [];
  const urlFor = (path: string) => signed.find((s) => s.path === path)?.signedUrl;

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("vault_t")}</h1>
          <p>{t("vault_s")}</p>
        </div>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      {edit && (
        <form action={uploadDoc} className="sec">
          <div className="fields">
            <div className="fld">
              <label htmlFor="kind">{t("kind")}</label>
              <select id="kind" name="kind" defaultValue="brela">
                {STD_DOCS.map(([k]) => (
                  <option key={k} value={k}>
                    {stdLabel(k, lang)}
                  </option>
                ))}
                <option value="other">—</option>
              </select>
            </div>
            <div className="fld">
              <label htmlFor="title">{t("docName")}</label>
              <input id="title" name="title" />
            </div>
            <div className="fld">
              <label htmlFor="expires_on">{t("expires")}</label>
              <input id="expires_on" name="expires_on" type="date" />
            </div>
            <div className="fld">
              <label htmlFor="file">PDF / JPG</label>
              <input id="file" name="file" type="file" accept="application/pdf,image/*" required />
            </div>
          </div>
          <div className="actions">
            <button className="btn gold" type="submit">{t("upload")}</button>
          </div>
        </form>
      )}
      <div className="tbl-wrap">
        <table style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th>{t("kind")}</th>
              <th>{t("docName")}</th>
              <th>{t("expires")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs?.length ? (
              docs.map((d) => {
                const n = daysUntil(d.expires_on);
                const url = urlFor(d.storage_path);
                return (
                  <tr key={d.id}>
                    <td>{d.kind === "other" ? "—" : stdLabel(d.kind, lang)}</td>
                    <td style={{ fontWeight: 600 }}>{d.title}</td>
                    <td className="num">
                      {fmtDate(d.expires_on, lang)}{" "}
                      {n != null && n < 0 && <span className="chip bad">{t("expired")}</span>}
                      {n != null && n >= 0 && n <= 30 && <span className="chip warn">{t("inDays", { n })}</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {url && (
                        <a className="btn sm" href={url} target="_blank" rel="noopener noreferrer">
                          {t("open")}
                        </a>
                      )}{" "}
                      {edit && (
                        <form action={deleteDoc} className="inline-form">
                          <input type="hidden" name="doc" value={d.id} />
                          <button className="xbtn" type="submit" aria-label={t("remove")}>×</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="empty">{t("vault_empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
