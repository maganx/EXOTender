"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addReadDocuments, readTenderDocument, recordTenderFile } from "@/app/app/tenders/files";
import { pdfText, safeName } from "@/lib/pdftext";
import type { ReadItem, SupplyItem } from "@/lib/reader";
import { createClient } from "@/lib/supabase/client";

const MAX_MB = 25;

type Labels = Record<
  | "upload" | "uploading" | "kind" | "k_tender" | "k_bid" | "k_other" | "forDoc" | "none" | "file" | "tooBig"
  | "ai_h" | "ai_hint" | "ai_pick" | "ai_pages" | "ai_asking" | "ai_found" | "ai_add" | "ai_left" | "ai_cancel" | "ai_page" | "sup_found" | "sup_hint" | "sup_qty" | "sup_days",
  string
>;

async function upload(orgId: string, tenderId: string, file: File) {
  const path = `${orgId}/tenders/${tenderId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await createClient()
    .storage.from("company-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return path;
}

/** Upload bid files straight to Storage, optionally against one required document. */
export function FileUpload({ orgId, tenderId, docs, L }: { orgId: string; tenderId: string; docs: { id: string; label: string }[]; L: Labels }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const files = (fd.getAll("file") as File[]).filter((f) => f.size);
    if (!files.length) return;
    if (files.some((f) => f.size > MAX_MB * 1024 * 1024)) return setErr(L.tooBig);
    setBusy(true);
    setErr("");
    try {
      for (const f of files) {
        const path = await upload(orgId, tenderId, f);
        const r = await recordTenderFile({ tenderId, path, title: f.name, size: f.size, kind: String(fd.get("kind")), docId: String(fd.get("doc") || "") || null });
        if (!r.ok) throw new Error(r.error);
      }
      form.reset();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="upl">
      <div className="fields">
        <div className="fld">
          <label htmlFor="up-kind">{L.kind}</label>
          <select id="up-kind" name="kind" defaultValue="bid">
            <option value="bid">{L.k_bid}</option>
            <option value="tender">{L.k_tender}</option>
            <option value="other">{L.k_other}</option>
          </select>
        </div>
        <div className="fld">
          <label htmlFor="up-doc">{L.forDoc}</label>
          <select id="up-doc" name="doc" defaultValue="">
            <option value="">{L.none}</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="fld wide">
          <label htmlFor="up-file">{L.file}</label>
          <input id="up-file" name="file" type="file" multiple required />
        </div>
      </div>
      {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
      <div className="actions">
        <button className="btn gold" type="submit" disabled={busy}>{busy ? L.uploading : L.upload}</button>
      </div>
    </form>
  );
}

/** Pick the tender document PDF: it is saved to the tender and Claude lists the documents the bid needs. */
export function TenderReader({ orgId, tenderId, L }: { orgId: string; tenderId: string; L: Labels }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ summary: string; documents: ReadItem[]; supplies: SupplyItem[]; left: number } | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [keepS, setKeepS] = useState<boolean[]>([]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) return setErr(L.tooBig);
    setBusy(true);
    setErr("");
    setFound(null);
    try {
      setStatus(L.uploading);
      const path = await upload(orgId, tenderId, file);
      const saved = await recordTenderFile({ tenderId, path, title: file.name, size: file.size, kind: "tender", docId: null });
      if (!saved.ok) throw new Error(saved.error);
      const { text } = await pdfText(file, (n, total) => setStatus(L.ai_pages.replace("{n}", String(n)).replace("{total}", String(total))));
      setStatus(L.ai_asking);
      const r = await readTenderDocument(tenderId, text);
      if (!r.ok) throw new Error(r.error);
      setFound(r);
      setKeep(r.documents.map(() => true));
      setKeepS(r.supplies.map(() => true));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
      router.refresh();
    }
  }

  async function onAdd() {
    if (!found) return;
    setBusy(true);
    const r = await addReadDocuments(
      tenderId,
      found.documents.filter((_, i) => keep[i]),
      found.summary,
      found.supplies.filter((_, i) => keepS[i]),
    );
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setFound(null);
    router.refresh();
  }

  return (
    <div className="reader">
      <h3>{L.ai_h}</h3>
      <p>{L.ai_hint}</p>
      <div className="row">
        <label className={`btn gold${busy ? " disabled" : ""}`}>
          {L.ai_pick}
          <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} hidden />
        </label>
        {status && <span className="st">{status}</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {found && (
        <>
          <p><b>{L.ai_found.replace("{n}", String(found.documents.length))}</b> {found.summary}</p>
          <div className="found">
            {found.documents.map((d, i) => (
              <label key={i}>
                <input type="checkbox" checked={keep[i] ?? false} onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))} />
                <span>
                  <span style={{ fontWeight: 600 }}>{d.label}</span>
                  {(d.section || d.page) && (
                    <span className="dsec"> · <b>{d.section}</b>{d.page ? ` (${L.ai_page} ${d.page})` : ""}</span>
                  )}
                  {d.note && <span className="am" style={{ display: "block", whiteSpace: "normal" }}>{d.note}</span>}
                </span>
              </label>
            ))}
          </div>
          {found.supplies.length > 0 && (
            <>
              <p style={{ marginTop: 14 }}>
                <b>{L.sup_found.replace("{n}", String(found.supplies.length))}</b> {L.sup_hint}
              </p>
              <div className="found">
                {found.supplies.map((s, i) => (
                  <label key={i}>
                    <input type="checkbox" checked={keepS[i] ?? false} onChange={(e) => setKeepS((k) => k.map((v, j) => (j === i ? e.target.checked : v)))} />
                    <span>
                      <span style={{ fontWeight: 600 }}>{s.item}</span>
                      {s.qty && <span className="dsec"> · {L.sup_qty} <b>{s.qty}</b></span>}
                      {(s.site || s.days) && (
                        <span className="am" style={{ display: "block", whiteSpace: "normal" }}>
                          {[s.site, s.days ? L.sup_days.replace("{n}", String(s.days)) : ""].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="st">{L.ai_left.replace("{n}", String(found.left))}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="button" onClick={() => setFound(null)} disabled={busy}>{L.ai_cancel}</button>
              <button className="btn gold" type="button" onClick={onAdd} disabled={busy}>{L.ai_add}</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
