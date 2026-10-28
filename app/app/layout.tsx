import Link from "next/link";
import { signOut } from "@/app/actions";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { OrgSwitch } from "@/components/OrgSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { canEdit, canEditPayments, fmtDate } from "@/lib/domain";
import { getT } from "@/lib/i18n";
import { requireOrg } from "@/lib/org";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const { t, lang } = await getT();
  const daysLeft = ctx.sub.endsAt ? Math.ceil((Date.parse(ctx.sub.endsAt) - Date.now()) / 86400000) : null;
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
              ...(canEditPayments(ctx.role) ? [{ href: "/app/billing", label: t("nav_billing") }] : []),
              ...(ctx.platformAdmin ? [{ href: "/app/admin", label: t("nav_admin") }] : []),
            ]}
          />
          <div className="tools">
            <LangSwitch back="/app" />
            <ThemeSwitch back="/app" />
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
      <main className="wrap page">
        {daysLeft != null && daysLeft <= 5 && (
          <div className={`subbar${ctx.sub.active ? "" : " bad"}`}>
            <span>{ctx.sub.active ? t("bill_soon", { n: Math.max(0, daysLeft) }) : t("bill_expired", { d: fmtDate(ctx.sub.endsAt, lang) })}</span>
            {canEditPayments(ctx.role) && (
              <Link className="btn sm gold" href="/app/billing">{t("bill_payNow")}</Link>
            )}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
