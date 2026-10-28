import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Contract, Role, Summary, Tender } from "./domain";

export type OrgCtx = {
  userId: string;
  email: string;
  orgId: string;
  orgName: string;
  role: Role;
  orgs: { id: string; name: string; role: Role }[];
  sub: Subscription;
  platformAdmin: boolean;
};

export type Subscription = {
  plan: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  /** end of the time the company may use the app; null before billing is set up */
  endsAt: string | null;
  active: boolean;
  trial: boolean;
};

type OrgEmbed = { name: string; plan?: string; trial_ends_at?: string | null; paid_until?: string | null };

function subscription(o: OrgEmbed | null): Subscription {
  const trialEndsAt = o?.trial_ends_at ?? null;
  const paidUntil = o?.paid_until ?? null;
  if (!trialEndsAt) return { plan: o?.plan ?? "trial", trialEndsAt, paidUntil, endsAt: null, active: true, trial: false };
  const ends = Math.max(Date.parse(trialEndsAt), paidUntil ? Date.parse(paidUntil) : 0);
  return {
    plan: o?.plan ?? "trial",
    trialEndsAt,
    paidUntil,
    endsAt: new Date(ends).toISOString(),
    active: ends > Date.now(),
    trial: !paidUntil || Date.parse(paidUntil) < Date.parse(trialEndsAt),
  };
}

// pages an expired company can still open
const OPEN_WHEN_EXPIRED = ["/app/billing", "/app/admin"];

/** Signed-in user and the company they are working in; redirects when either is missing. */
export async function requireOrg(): Promise<OrgCtx> {
  const supabase = (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  type Row = { org_id: string; role: string; organizations: unknown };
  const res = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name, plan, trial_ends_at, paid_until)")
    .eq("user_id", user.id);
  let rows: Row[] | null = res.data;
  // database without the billing columns yet (0002 not run): carry on without billing
  if (res.error) rows = (await supabase.from("memberships").select("org_id, role, organizations(name, plan)").eq("user_id", user.id)).data;
  const orgs = (rows ?? []).map((m) => {
    const o = one<OrgEmbed>(m.organizations);
    return { id: m.org_id as string, role: m.role as Role, name: o?.name ?? "—", sub: subscription(o) };
  });
  if (!orgs.length) redirect("/onboarding");

  const wanted = (await cookies()).get("org")?.value;
  const cur = orgs.find((o) => o.id === wanted) ?? orgs[0];
  const { data: pa } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();

  const path = (await headers()).get("x-path") ?? "";
  if (!cur.sub.active && !OPEN_WHEN_EXPIRED.some((p) => path.startsWith(p))) redirect("/app/billing");

  return {
    userId: user.id,
    email: user.email ?? "",
    orgId: cur.id,
    orgName: cur.name,
    role: cur.role,
    orgs: orgs.map(({ id, name, role }) => ({ id, name, role })),
    sub: cur.sub,
    platformAdmin: !!pa,
  };
}

/** PostgREST returns one-to-one embeds as an object or a one-item array depending on detection. */
export function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export type TenderRow = Tender & { summary: Summary };

/** Tenders of the current company with what the lists need to compute next steps. */
export async function loadTenders(orgId: string): Promise<TenderRow[]> {
  const supabase = (await createClient());
  const { data, error } = await supabase
    .from("tenders")
    .select("*, tender_documents(status), deliveries(status), invoices(amount, paid), tender_contracts(*), tender_pricing(bid_price)")
    .eq("org_id", orgId)
    .order("deadline", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const docs = (r.tender_documents ?? []) as { status: string }[];
    const dels = (r.deliveries ?? []) as { status: string }[];
    const invs = (r.invoices ?? []) as { amount: number; paid: number }[];
    const c = one<Contract>(r.tender_contracts);
    const p = one<{ bid_price: number | null }>(r.tender_pricing);
    const counted = docs.filter((d) => d.status !== "na");
    const inv = invs.reduce((a, i) => a + Number(i.amount || 0), 0);
    const paid = invs.reduce((a, i) => a + Number(i.paid || 0), 0);
    const bid = Number(p?.bid_price || 0);
    const summary: Summary = {
      docsDone: counted.filter((d) => d.status === "done").length,
      docsTotal: counted.length,
      deliveries: dels.length,
      accepted: dels.filter((d) => d.status === "accepted").length,
      invoices: invs.length,
      outstanding: Math.max(0, inv - paid),
      value: Number(c?.contract_value || 0) || Number(c?.award_amount || 0) || bid,
      bid,
      psSubmitted: !!c?.ps_submitted,
      psExpiry: c?.ps_expiry ?? null,
      signedAt: c?.signed_at ?? null,
      startDate: c?.start_date ?? null,
      endDate: c?.end_date ?? null,
      awardDate: c?.award_date ?? null,
      standstillEnd: c?.standstill_end ?? null,
    };
    const { tender_documents, deliveries, invoices, tender_contracts, tender_pricing, ...t } = r;
    return { ...(t as Tender), summary };
  });
}
