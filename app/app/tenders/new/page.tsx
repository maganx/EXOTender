import Link from "next/link";
import { redirect } from "next/navigation";
import { createTender } from "../actions";
import { canEdit } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";

export default async function NewTender(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  if (!canEdit(ctx.role)) redirect("/app/tenders");
  const { t } = (await getT());
  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("newT")}</h1>
        </div>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      <form action={createTender} className="sec">
        <div className="fields">
          <div className="fld">
            <label htmlFor="tender_no">{t("f_no")}</label>
            <input id="tender_no" name="tender_no" required />
          </div>
          <div className="fld wide">
            <label htmlFor="title">{t("f_title")}</label>
            <input id="title" name="title" required />
          </div>
          <div className="fld">
            <label htmlFor="entity">{t("f_entity")}</label>
            <input id="entity" name="entity" />
          </div>
          <div className="fld">
            <label htmlFor="category">{t("f_cat")}</label>
            <select id="category" name="category" defaultValue="goods">
              <option value="goods">{t("cat_goods")}</option>
              <option value="works">{t("cat_works")}</option>
              <option value="nc">{t("cat_nc")}</option>
              <option value="cons">{t("cat_cons")}</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="deadline">{t("f_dead")}</label>
            <input id="deadline" name="deadline" type="datetime-local" />
          </div>
          <div className="fld">
            <label htmlFor="nest_url">{t("f_nest")}</label>
            <input id="nest_url" name="nest_url" type="url" placeholder="https://nest.go.tz/..." />
          </div>
        </div>
        <div className="actions">
          <Link className="btn ghost" href="/app/tenders">
            {t("cancel")}
          </Link>
          <button className="btn gold" type="submit">
            {t("add")}
          </button>
        </div>
      </form>
    </>
  );
}
