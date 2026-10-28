import Link from "next/link";
import { notFound } from "next/navigation";
import * as A from "../actions";
import { DueChip, StageTag } from "@/components/bits";
import {
  STAGES, addDays, canEdit, canEditPayments, canSeeMoney, fmtDate, isAdmin, money, nextAction, toLocalInput,
  type Contract, type Delivery, type Invoice, type Pricing, type Stage, type Summary, type TDoc, type Tender,
} from "@/lib/domain";
import { getT, type Key, type T } from "@/lib/i18n";
import { one, requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

const TABS = ["info", "docs", "price", "contract", "supply", "pay", "log"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY: Record<Tab, Key> = { info: "t_info", docs: "t_docs", price: "t_price", contract: "t_contract", supply: "t_supply", pay: "t_pay", log: "t_log" };

const fmtNum = (n: number | null | undefined) => (n == null ? "" : Number(n).toLocaleString("en-US"));

function Field({ label, name, value, type = "text", wide, money: isMoney }: { label: string; name: string; value?: string | number | null; type?: string; wide?: boolean; money?: boolean }) {
  return (
    <div className={`fld${wide ? " wide" : ""}`}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {isMoney ? (
        <input id={`f-${name}`} name={name} inputMode="numeric" placeholder="0" defaultValue={fmtNum(value as number | null)} />
      ) : (
        <input id={`f-${name}`} name={name} type={type} defaultValue={value ?? ""} />
      )}
    </div>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: [string, string][] }) {
  return (
    <div className="fld">
      <label htmlFor={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function SaveBar({ t }: { t: T }) {
  return (
    <div className="actions">
      <button className="btn gold" type="submit">
        {t("save")}
      </button>
    </div>
  );
}

export default async function TenderPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const ctx = await requireOrg();
  const { t, lang } = getT();
  const supabase = createClient();
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "info";

  const { data: row } = await supabase
    .from("tenders")
    .select("*, tender_documents(*), deliveries(*), invoices(*), tender_contracts(*), tender_pricing(*)")
    .eq("id", params.id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!row) notFound();

  const x = row as unknown as Tender;
  const docs = ((row.tender_documents ?? []) as (TDoc & { sort: number; created_at: string })[]).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
  const dels = ((row.deliveries ?? []) as (Delivery & { created_at: string })[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const invs = ((row.invoices ?? []) as (Invoice & { created_at: string })[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const c = one<Contract>(row.tender_contracts);
  const p = one<Pricing>(row.tender_pricing);

  const edit = canEdit(ctx.role);
  const seeMoney = canSeeMoney(ctx.role);
  const editPay = canEditPayments(ctx.role);

  const counted = docs.filter((d) => d.status !== "na");
  const inv = invs.reduce((a, i) => a + Number(i.amount || 0), 0);
  const paid = invs.reduce((a, i) => a + Number(i.paid || 0), 0);
  const summary: Summary = {
    docsDone: counted.filter((d) => d.status === "done").length,
    docsTotal: counted.length,
    deliveries: dels.length,
    accepted: dels.filter((d) => d.status === "accepted").length,
    invoices: invs.length,
    outstanding: Math.max(0, inv - paid),
    value: Number(c?.contract_value || 0) || Number(c?.award_amount || 0) || Number(p?.bid_price || 0),
    bid: Number(p?.bid_price || 0),
    psSubmitted: !!c?.ps_submitted,
    psExpiry: c?.ps_expiry ?? null,
    signedAt: c?.signed_at ?? null,
    startDate: c?.start_date ?? null,
    endDate: c?.end_date ?? null,
    awardDate: c?.award_date ?? null,
    standstillEnd: c?.standstill_end ?? null,
  };
  const na = nextAction(x, summary, t, lang);
  const si = STAGES.indexOf(x.stage as (typeof STAGES)[number]);
  const next: Stage | null = si >= 0 && si < STAGES.length - 1 ? STAGES[si + 1] : null;

  const StageBtn = ({ stage, label, cls, gold }: { stage: Stage; label: string; cls?: string; gold?: boolean }) => (
    <form action={A.setStage}>
      <input type="hidden" name="id" value={x.id} />
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="stage" value={stage} />
      <button type="submit" className={gold ? "btn sm gold" : cls} disabled={!edit}>
        {label}
      </button>
    </form>
  );

  return (
    <>
      <div className="detail-head">
        <div className="dtop">
          <div className="ttl">
            <div className="no num">
              {x.tender_no} {x.source === "nest" && <span className="chip gold">NeST</span>}
            </div>
            <h2>{x.title}</h2>
            <div className="am">
              {x.entity}
              {x.nest_url && /^https:\/\/([a-z0-9-]+\.)*nest\.go\.tz\//i.test(x.nest_url) && (
                <>
                  {" · "}
                  <a href={x.nest_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-strong)" }}>
                    NeST ↗
                  </a>
                </>
              )}
            </div>
          </div>
          <Link className="close" href="/app/tenders" aria-label="Close" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
            ×
          </Link>
        </div>
        <div className="steps">
          {STAGES.map((s, i) => (
            <StageBtn key={s} stage={s} label={t(`s_${s}`)} cls={x.stage === "lost" ? "" : i < si ? "done" : i === si ? "cur" : ""} />
          ))}
          {x.stage === "lost" && <button className="lostcur" disabled>{t("s_lost")}</button>}
        </div>
        {na ? (
          <div className="nextbar">
            <b>{t("next")}</b>
            <span className="txt">{na.text}</span>
            {na.due && <DueChip date={na.due} t={t} />}
            {next && <StageBtn stage={next} label={`${t("adv")} →`} gold />}
            {(x.stage === "submitted" || x.stage === "eval") && <StageBtn stage="lost" label={t("markLost")} cls="btn sm" />}
          </div>
        ) : (
          <div className="nextbar">
            <span className="txt">
              <StageTag stage={x.stage} t={t} />
            </span>
            <StageBtn stage={x.stage === "lost" ? "eval" : "payment"} label={t("reopen")} cls="btn sm" />
          </div>
        )}
        {searchParams.msg && <div className="err" style={{ marginBottom: 10 }}>{searchParams.msg}</div>}
        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <Link key={k} href={`/app/tenders/${x.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>
              {t(TAB_KEY[k])}
            </Link>
          ))}
        </div>
      </div>

      {!edit && <div className="notice">{t("readOnly")}</div>}

      {tab === "info" && (
        <form action={A.saveInfo} className="page">
          <input type="hidden" name="id" value={x.id} />
          <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }} className="page">
            <section className="sec">
              <div className="fields">
                <Field label={t("f_no")} name="tender_no" value={x.tender_no} />
                <Field label={t("f_title")} name="title" value={x.title} wide />
                <Field label={t("f_entity")} name="entity" value={x.entity} />
                <Select label={t("f_cat")} name="category" value={x.category} options={[["goods", t("cat_goods")], ["works", t("cat_works")], ["nc", t("cat_nc")], ["cons", t("cat_cons")]]} />
                <Field label={t("f_method")} name="method" value={x.method} />
                <Field label={t("f_region")} name="region" value={x.region} />
                <Field label={t("f_nest")} name="nest_url" value={x.nest_url} type="url" />
              </div>
            </section>
            <section className="sec">
              <div className="fields">
                <Field label={t("f_pub")} name="published_at" value={x.published_at} type="date" />
                <Field label={t("f_clar")} name="clarify_by" value={x.clarify_by} type="date" />
                <Field label={t("f_dead")} name="deadline" value={toLocalInput(x.deadline)} type="datetime-local" />
                <Field label={t("f_open")} name="opening_at" value={toLocalInput(x.opening_at)} type="datetime-local" />
                <Field label={t("f_valid")} name="validity_days" value={x.validity_days} type="number" />
                <div className="fld">
                  <label>{t("validTill")}</label>
                  <div className="ro num">{fmtDate(addDays(x.deadline, x.validity_days || 90), lang)}</div>
                </div>
              </div>
            </section>
            <section className="sec">
              <div className="fields">
                <Select label={t("f_bsType")} name="bid_security_type" value={x.bid_security_type} options={[["decl", t("bs_decl")], ["guar", t("bs_guar")], ["none", t("bs_none")]]} />
                <Field label={t("f_bsAmt")} name="bid_security_amount" value={x.bid_security_amount} money />
                <Field label={t("f_bsExp")} name="bid_security_expiry" value={x.bid_security_expiry} type="date" />
              </div>
            </section>
            <section className="sec">
              <div className="fld">
                <label htmlFor="f-notes">{t("f_notes")}</label>
                <textarea id="f-notes" name="notes" defaultValue={x.notes ?? ""} />
              </div>
              {edit && <SaveBar t={t} />}
            </section>
          </fieldset>
        </form>
      )}
      {tab === "info" && isAdmin(ctx.role) && (
        <details className="danger sec">
          <summary>{t("del")}</summary>
          <form action={A.deleteTender} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={x.id} />
            <button className="btn danger sm" type="submit">
              {t("delConfirm")}
            </button>
          </form>
        </details>
      )}

      {tab === "docs" && <DocsTab x={x} docs={docs} edit={edit} t={t} orgId={ctx.orgId} />}

      {tab === "price" &&
        (seeMoney ? (
          <form action={A.savePricing} className="sec">
            <input type="hidden" name="id" value={x.id} />
            <h3>{t("price_h")}</h3>
            <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="fields">
                <Field label={t("f_cost")} name="cost" value={p?.cost} money />
                <Field label={t("f_trans")} name="transport" value={p?.transport} money />
                <Field label={t("f_other")} name="other" value={p?.other} money />
                <Field label={t("f_bid")} name="bid_price" value={p?.bid_price} money />
              </div>
              <PriceStats p={p} t={t} />
              {edit && <SaveBar t={t} />}
            </fieldset>
          </form>
        ) : (
          <div className="notice">{t("noMoney")}</div>
        ))}

      {tab === "contract" && (
        <form action={A.saveContract} className="page">
          <input type="hidden" name="id" value={x.id} />
          <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }} className="page">
            <section className="sec">
              <h3>{t("award_h")}</h3>
              <div className="fields">
                <Field label={t("f_awDate")} name="award_date" value={c?.award_date} type="date" />
                {seeMoney && <Field label={t("f_awAmt")} name="award_amount" value={c?.award_amount} money />}
                <Field label={t("f_stand")} name="standstill_end" value={c?.standstill_end} type="date" />
                <Field label={t("f_accept")} name="accepted_at" value={c?.accepted_at} type="date" />
              </div>
            </section>
            <section className="sec">
              <h3>{t("con_h")}</h3>
              <div className="fields">
                <Field label={t("f_cNo")} name="contract_no" value={c?.contract_no} />
                <Field label={t("f_cSigned")} name="signed_at" value={c?.signed_at} type="date" />
                {seeMoney && <Field label={t("f_cVal")} name="contract_value" value={c?.contract_value} money />}
                <Field label={t("f_lpo")} name="lpo_no" value={c?.lpo_no} />
                <Field label={t("f_cStart")} name="start_date" value={c?.start_date} type="date" />
                <Field label={t("f_cEnd")} name="end_date" value={c?.end_date} type="date" />
              </div>
            </section>
            <section className="sec">
              <h3>{t("ps_h")}</h3>
              <div className="fields">
                {seeMoney && <Field label={t("f_psAmt")} name="ps_amount" value={c?.ps_amount} money />}
                <Field label={t("f_psExp")} name="ps_expiry" value={c?.ps_expiry} type="date" />
                <Select label={t("f_psDone")} name="ps_submitted" value={String(!!c?.ps_submitted)} options={[["false", t("no")], ["true", t("yes")]]} />
              </div>
              {/* hidden money fields keep their values when a viewer-level form would otherwise blank them */}
              {!seeMoney && (
                <>
                  <input type="hidden" name="award_amount" value={c?.award_amount ?? ""} />
                  <input type="hidden" name="contract_value" value={c?.contract_value ?? ""} />
                  <input type="hidden" name="ps_amount" value={c?.ps_amount ?? ""} />
                </>
              )}
              {edit && <SaveBar t={t} />}
            </section>
          </fieldset>
        </form>
      )}

      {tab === "supply" && (
        <section className="sec">
          <h3>{t("sup_h")}</h3>
          <div className="rows">
            <table>
              <thead>
                <tr>
                  <th>{t("d_item")}</th>
                  <th>{t("d_qty")}</th>
                  <th>{t("d_date")}</th>
                  <th>{t("d_dn")}</th>
                  <th>{t("d_status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dels.map((r) => (
                  <tr key={r.id}>
                    <td colSpan={6} style={{ padding: 0, border: 0 }}>
                      <form action={A.saveDelivery} style={{ display: "grid", gridTemplateColumns: "minmax(140px,2fr) 80px 140px 110px 160px auto", gap: 6, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="row_id" value={r.id} />
                        <fieldset disabled={!edit} style={{ display: "contents" }}>
                          <input className="mini" name="item" defaultValue={r.item} aria-label={t("d_item")} />
                          <input className="mini" name="qty" defaultValue={r.qty ?? ""} aria-label={t("d_qty")} />
                          <input className="mini" type="date" name="delivery_date" defaultValue={r.delivery_date ?? ""} aria-label={t("d_date")} />
                          <input className="mini" name="delivery_note" defaultValue={r.delivery_note ?? ""} aria-label={t("d_dn")} />
                          <select className="mini" name="status" defaultValue={r.status} aria-label={t("d_status")}>
                            <option value="planned">{t("dl_planned")}</option>
                            <option value="delivered">{t("dl_delivered")}</option>
                            <option value="accepted">{t("dl_accepted")}</option>
                          </select>
                          <span style={{ display: "flex", gap: 4 }}>
                            <button className="btn sm" type="submit">{t("save")}</button>
                            <button className="xbtn" type="submit" name="remove" value="1" aria-label={t("remove")}>×</button>
                          </span>
                        </fieldset>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edit && (
            <form action={A.addDelivery} className="inline addrow">
              <input type="hidden" name="id" value={x.id} />
              <input className="mini" name="item" placeholder={t("d_item")} aria-label={t("d_item")} />
              <button className="btn sm" type="submit">+ {t("add")}</button>
            </form>
          )}
        </section>
      )}

      {tab === "pay" &&
        (seeMoney ? (
          <section className="sec">
            <h3>{t("pay_h")}</h3>
            <div className="rows">
              <table>
                <thead>
                  <tr>
                    <th>{t("p_inv")}</th>
                    <th>{t("p_date")}</th>
                    <th>{t("p_amt")}</th>
                    <th>{t("p_paid")}</th>
                    <th>{t("p_paidOn")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invs.map((r) => (
                    <tr key={r.id}>
                      <td colSpan={6} style={{ padding: 0, border: 0 }}>
                        <form action={A.saveInvoice} style={{ display: "grid", gridTemplateColumns: "120px 140px 1fr 1fr 140px auto", gap: 6, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="row_id" value={r.id} />
                          <fieldset disabled={!editPay} style={{ display: "contents" }}>
                            <input className="mini" name="invoice_no" defaultValue={r.invoice_no ?? ""} aria-label={t("p_inv")} />
                            <input className="mini" type="date" name="invoice_date" defaultValue={r.invoice_date ?? ""} aria-label={t("p_date")} />
                            <input className="mini" name="amount" inputMode="numeric" defaultValue={fmtNum(r.amount)} aria-label={t("p_amt")} />
                            <input className="mini" name="paid" inputMode="numeric" defaultValue={fmtNum(r.paid)} aria-label={t("p_paid")} />
                            <input className="mini" type="date" name="paid_on" defaultValue={r.paid_on ?? ""} aria-label={t("p_paidOn")} />
                            <span style={{ display: "flex", gap: 4 }}>
                              <button className="btn sm" type="submit">{t("save")}</button>
                              <button className="xbtn" type="submit" name="remove" value="1" aria-label={t("remove")}>×</button>
                            </span>
                          </fieldset>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editPay && (
              <form action={A.addInvoice} className="inline addrow">
                <input type="hidden" name="id" value={x.id} />
                <input className="mini" name="invoice_no" placeholder={t("p_inv")} aria-label={t("p_inv")} />
                <input className="mini" name="amount" inputMode="numeric" placeholder={t("p_amt")} aria-label={t("p_amt")} />
                <button className="btn sm" type="submit">+ {t("add")}</button>
              </form>
            )}
            <div className="stat-line">
              <div><span>{t("invoiced")}</span><strong className="num">{money(inv)}</strong></div>
              <div><span>{t("paid")}</span><strong className="num ok">{money(paid)}</strong></div>
              <div><span>{t("outstanding")}</span><strong className={`num ${inv - paid > 0 ? "bad" : ""}`}>{money(Math.max(0, inv - paid))}</strong></div>
            </div>
          </section>
        ) : (
          <div className="notice">{t("noMoney")}</div>
        ))}

      {tab === "log" && <LogTab id={x.id} canWrite={ctx.role !== "viewer"} t={t} lang={lang} />}
    </>
  );
}

function PriceStats({ p, t }: { p: Pricing | null; t: T }) {
  const cost = Number(p?.cost || 0) + Number(p?.transport || 0) + Number(p?.other || 0);
  const bid = Number(p?.bid_price || 0);
  const ex = bid / 1.18;
  const m = ex - cost;
  return (
    <div className="stat-line">
      <div><span>{t("exVat")}</span><strong className="num">{money(ex)}</strong></div>
      <div><span>{t("vatPart")}</span><strong className="num">{money(bid - ex)}</strong></div>
      <div>
        <span>{t("margin")}</span>
        <strong className={`num ${bid && m < 0 ? "bad" : bid ? "ok" : ""}`}>{bid ? `${money(m)} (${((m / ex) * 100).toFixed(1)}%)` : "—"}</strong>
      </div>
    </div>
  );
}

async function DocsTab({ x, docs, edit, t, orgId }: { x: Tender; docs: TDoc[]; edit: boolean; t: T; orgId: string }) {
  const { data: vault } = await createClient().from("company_documents").select("id, title, kind, expires_on").eq("org_id", orgId).order("title");
  const counted = docs.filter((d) => d.status !== "na");
  const done = counted.filter((d) => d.status === "done").length;
  return (
    <section className="sec">
      <h3>
        {t("docs_h")} <span className={`chip ${done === counted.length && counted.length ? "ok" : ""}`}>{done} / {counted.length}</span>
      </h3>
      <p className="hint">{t("docs_hint")}</p>
      <div className="progress"><i style={{ width: `${counted.length ? (done / counted.length) * 100 : 0}%` }} /></div>
      <div className="docs">
        {docs.map((d) => (
          <form key={d.id} action={A.saveDoc} className={`doc${d.status === "na" ? " na" : ""}`} style={{ gridTemplateColumns: "110px minmax(0,1fr) auto" }}>
            <input type="hidden" name="id" value={x.id} />
            <input type="hidden" name="doc_id" value={d.id} />
            <fieldset disabled={!edit} style={{ display: "contents" }}>
              <select className="mini" name="status" defaultValue={d.status} aria-label={t("d_status")}>
                <option value="pending">{t("ds_pending")}</option>
                <option value="done">{t("ds_done")}</option>
                <option value="na">{t("ds_na")}</option>
              </select>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="dl">{d.label}</span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input className="mini" style={{ flex: "1 1 140px" }} name="section" defaultValue={d.section ?? ""} placeholder={t("section")} aria-label={t("section")} />
                  <input className="mini" style={{ flex: "2 1 180px" }} name="note" defaultValue={d.note ?? ""} placeholder={t("f_notes")} aria-label={t("f_notes")} />
                  <select className="mini" style={{ flex: "1 1 160px" }} name="company_document_id" defaultValue={d.company_document_id ?? ""} aria-label={t("vaultFile")}>
                    <option value="">{t("vaultFile")}…</option>
                    {(vault ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </span>
              </span>
              <span style={{ display: "flex", gap: 4 }}>
                <button className="btn sm" type="submit">{t("save")}</button>
                <button className="xbtn" type="submit" name="remove" value="1" aria-label={t("remove")}>×</button>
              </span>
            </fieldset>
          </form>
        ))}
      </div>
      {edit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <form action={A.addDoc} className="inline" style={{ flex: "1 1 320px" }}>
            <input type="hidden" name="id" value={x.id} />
            <input className="mini" name="label" placeholder={t("docName")} aria-label={t("docName")} required />
            <input className="mini" name="section" placeholder={t("section")} aria-label={t("section")} />
            <button className="btn sm" type="submit">+ {t("add")}</button>
          </form>
          {!docs.some((d) => d.std_key) && (
            <form action={A.addStdDocs}>
              <input type="hidden" name="id" value={x.id} />
              <button className="btn sm" type="submit">{t("addStd")}</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

async function LogTab({ id, canWrite, t, lang }: { id: string; canWrite: boolean; t: T; lang: "sw" | "en" }) {
  const supabase = createClient();
  const { data: log } = await supabase.from("activity_log").select("id, at, text, user_id").eq("tender_id", id).order("at", { ascending: false }).limit(200);
  const ids = Array.from(new Set((log ?? []).map((l) => l.user_id).filter(Boolean))) as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = (uid: string | null) => people?.find((p) => p.id === uid)?.full_name || "";
  return (
    <>
      {canWrite && (
        <form action={A.addNote} className="sec inline">
          <input type="hidden" name="id" value={id} />
          <input className="mini" name="text" placeholder={t("logPh")} aria-label={t("log_h")} required maxLength={2000} />
          <button className="btn sm gold" type="submit">{t("save")}</button>
        </form>
      )}
      <section className="sec">
        <h3>{t("log_h")}</h3>
        <div className="log">
          {(log ?? []).length ? (
            log!.map((l) => (
              <div key={l.id}>
                <time>{fmtDate(l.at, lang, true)}</time>
                <span>
                  {l.text}
                  {name(l.user_id) && <span className="am"> · {name(l.user_id)}</span>}
                </span>
              </div>
            ))
          ) : (
            <p className="empty">—</p>
          )}
        </div>
      </section>
    </>
  );
}
