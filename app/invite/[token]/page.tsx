import { redirect } from "next/navigation";
import { acceptInvitation } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({ params, searchParams }: { params: { token: string }; searchParams: Record<string, string | undefined> }) {
  const { t } = getT();
  const {
    data: { user },
  } = await createClient().auth.getUser();
  const here = `/invite/${encodeURIComponent(params.token)}`;
  if (!user) redirect(`/login?mode=signup&next=${encodeURIComponent(here)}`);
  return (
    <AuthShell back={here}>
      <h1>{t("invite_t")}</h1>
      <p>{user.email}</p>
      {searchParams.bad && <div className="err">{t("invite_bad")}</div>}
      <form action={acceptInvitation}>
        <input type="hidden" name="token" value={params.token} />
        <button className="btn gold" type="submit">
          {t("invite_accept")}
        </button>
      </form>
    </AuthShell>
  );
}
