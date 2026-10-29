import { siteUrl } from "@/lib/site";
import { cancelInvite, invite, removeMember, resendInvite, setRole } from "./actions";
import { emailConfigured } from "@/lib/email";
import { ROLES, fmtDate, isAdmin, type Role } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireOrg();
  const { t, lang } = (await getT());
  const supabase = (await createClient());
  const admin = isAdmin(ctx.role);
  const { data: members } = await supabase.from("memberships").select("user_id, role, created_at").eq("org_id", ctx.orgId);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  type Invite = { id: string; email: string; role: string; token: string; expires_at: string; emailed_at?: string | null };
  let invites: Invite[] = [];
  if (admin) {
    const q = (cols: string) =>
      supabase.from("invitations").select(cols).eq("org_id", ctx.orgId).is("accepted_at", null).order("created_at", { ascending: false });
    const res = await q("id, email, role, token, expires_at, emailed_at");
    // emailed_at arrives with migration 0004; list invitations without it until then
    invites = ((res.error ? (await q("id, email, role, token, expires_at")).data : res.data) ?? []) as unknown as Invite[];
  }
  const mail = emailConfigured();
  const site = await siteUrl();
  const assignable = ROLES.filter((r) => r !== "owner" || ctx.role === "owner");

  return (
    <>
      <div className="view-head">
        <div>
          <h1>{t("team_t")}</h1>
          <p>{t("team_s")}</p>
        </div>
      </div>
      {searchParams.msg && <div className="err">{searchParams.msg}</div>}
      {searchParams.sent && <div className="ok">{t("inv_sent")}</div>}
      {searchParams.nomail && <div className="ok">{t("inv_nomail")}</div>}
      <div className="grid2">
        <section className="panel-box">
          <h2>{t("members")}</h2>
          <div className="alist">
            {(members ?? []).map((m) => {
              const name = people?.find((p) => p.id === m.user_id)?.full_name || "—";
              const me = m.user_id === ctx.userId;
              return (
                <div key={m.user_id} className="arow" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span style={{ minWidth: 0 }}>
                    <div className="at">
                      {name} {me && <span className="am">({t("you")})</span>}
                    </div>
                    <div className="am">{t(`r_${m.role as Role}`)}</div>
                  </span>
                  {admin && !me && (m.role !== "owner" || ctx.role === "owner") ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <form action={setRole} className="inline">
                        <input type="hidden" name="user" value={m.user_id} />
                        <select className="mini" name="role" defaultValue={m.role} aria-label={t("role")}>
                          {assignable.map((r) => (
                            <option key={r} value={r}>
                              {t(`r_${r}`)}
                            </option>
                          ))}
                        </select>
                        <button className="btn sm" type="submit">{t("save")}</button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="user" value={m.user_id} />
                        <button className="xbtn" type="submit" aria-label={t("remove")}>×</button>
                      </form>
                    </span>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel-box">
          <h2>{t("role")}</h2>
          <div className="role-list">
            {ROLES.map((r) => (
              <div key={r}>
                <b>{t(`r_${r}`)}</b>: {t(`rd_${r}`)}
              </div>
            ))}
          </div>
        </section>
      </div>

      {admin ? (
        <section className="panel-box">
          <h2>{t("invite")}</h2>
          <form action={invite} className="inline" style={{ flexWrap: "wrap" }}>
            <input className="mini" style={{ flex: "2 1 220px" }} name="email" type="email" placeholder={t("email")} aria-label={t("email")} required />
            <select className="mini" style={{ flex: "1 1 140px" }} name="role" defaultValue="officer" aria-label={t("role")}>
              {ROLES.filter((r) => r !== "owner").map((r) => (
                <option key={r} value={r}>
                  {t(`r_${r}`)}
                </option>
              ))}
            </select>
            <button className="btn gold sm" type="submit">{t("invite")}</button>
          </form>
          {!!invites?.length && (
            <>
              <h2 style={{ marginTop: 18 }}>{t("invites")}</h2>
              <p className="hint" style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("inviteLink")}</p>
              <div className="alist">
                {invites.map((i) => (
                  <div key={i.id} className="arow" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      <span className="at">
                        {i.email} · {t(`r_${i.role as Role}`)}
                      </span>
                      <span className="copy">{`${site}/invite/${i.token}`}</span>
                      <span className="am">
                        {i.emailed_at ? `✓ ${t("inv_emailed")} · ` : ""}
                        {t("expires")} {fmtDate(i.expires_at, lang)}
                      </span>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        <a
                          className="btn sm"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`https://wa.me/?text=${encodeURIComponent(`${t("inv_waText", { org: ctx.orgName, email: i.email })} ${site}/invite/${i.token}`)}`}
                        >
                          {t("inv_wa")}
                        </a>
                        {mail && (
                          <form action={resendInvite}>
                            <input type="hidden" name="inv" value={i.id} />
                            <button className="btn sm" type="submit">{t("inv_resend")}</button>
                          </form>
                        )}
                      </span>
                    </span>
                    <form action={cancelInvite}>
                      <input type="hidden" name="inv" value={i.id} />
                      <button className="xbtn" type="submit" aria-label={t("cancel")}>×</button>
                    </form>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="notice">{t("adminOnly")}</div>
      )}
    </>
  );
}
