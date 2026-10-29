import Link from "next/link";
import { acceptInvitation, signOut } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import type { Role } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Info = { org_name: string; email: string; role: string; status: "open" | "used" | "expired" };

export default async function InvitePage(props: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { t } = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const here = `/invite/${encodeURIComponent(params.token)}`;

  // invitation_info comes with migration 0004; without it the page still works, just with less guidance
  const valid = /^[0-9a-f-]{36}$/i.test(params.token);
  const { data } = valid ? await supabase.rpc("invitation_info", { p_token: params.token }) : { data: null };
  const info = (Array.isArray(data) ? data[0] : data) as Info | undefined;
  const auth = (mode?: string) =>
    `/login?${mode ? `mode=${mode}&` : ""}next=${encodeURIComponent(here)}${info ? `&email=${encodeURIComponent(info.email)}` : ""}`;
  const wrong = !!(user && info && user.email && user.email.toLowerCase() !== info.email.toLowerCase());

  return (
    <AuthShell back={here}>
      <h1>{t("invite_t")}</h1>
      {info && <p>{t("invite_for", { org: info.org_name, role: t(`r_${info.role as Role}`) })}</p>}
      {info && (
        <p>
          {t("invite_email")}: <b style={{ color: "var(--fg)" }}>{info.email}</b>
        </p>
      )}
      {searchParams.bad && <div className="err">{t("invite_bad")}</div>}
      {info?.status === "used" && <div className="err">{t("invite_used")}</div>}
      {info?.status === "expired" && <div className="err">{t("invite_expired")}</div>}

      {!user && info?.status !== "used" && info?.status !== "expired" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link className="btn gold" href={auth("signup")} style={{ justifyContent: "center" }}>
            {t("invite_new")}
          </Link>
          <Link className="btn" href={auth()} style={{ justifyContent: "center" }}>
            {t("invite_have")}
          </Link>
        </div>
      )}

      {user && wrong && (
        <>
          <div className="err">{t("invite_wrong", { me: user.email ?? "", email: info!.email })}</div>
          <form action={signOut}>
            <input type="hidden" name="next" value={auth()} />
            <button className="btn gold" type="submit" style={{ width: "100%", justifyContent: "center" }}>
              {t("invite_switch")}
            </button>
          </form>
        </>
      )}

      {user && !wrong && info?.status !== "used" && info?.status !== "expired" && (
        <>
          {!info && <p>{user.email}</p>}
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={params.token} />
            <button className="btn gold" type="submit" style={{ width: "100%", justifyContent: "center" }}>
              {t("invite_accept")}
            </button>
          </form>
        </>
      )}
      {user && (info?.status === "used" || info?.status === "expired") && (
        <Link className="btn" href="/app" style={{ justifyContent: "center" }}>
          {t("nav_over")}
        </Link>
      )}
    </AuthShell>
  );
}
