import Link from "next/link";
import { signOut } from "@/app/actions";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { OrgSwitch } from "@/components/OrgSwitch";
import { canEdit } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const { t } = (await getT());
  return (
    <>
      <header className="band">
        <div className="wrap">
          <div className="brand">
            <Link href="/app" aria-label="Tenda Desk">
              <Logo />
            </Link>
            <div className="sub">
              {ctx.orgs.length > 1 ? <OrgSwitch orgs={ctx.orgs} current={ctx.orgId} /> : ctx.orgName}
              <br />
              <span>{t(`r_${ctx.role}`)}</span>
            </div>
          </div>
          <NavLinks
            items={[
              { href: "/app", label: t("nav_over") },
              { href: "/app/tenders", label: t("nav_tenders") },
              { href: "/app/nest", label: t("nav_nest") },
              { href: "/app/documents", label: t("nav_docs") },
              { href: "/app/team", label: t("nav_team") },
            ]}
          />
          <div className="tools">
            <LangSwitch back="/app" />
            {canEdit(ctx.role) && (
              <Link className="btn gold" href="/app/tenders/new">
                + {t("newT")}
              </Link>
            )}
            <form action={signOut} className="inline-form">
              <button className="lang" type="submit">
                {t("signout")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap page">{children}</main>
    </>
  );
}
