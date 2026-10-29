import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";
import { LangSwitch } from "@/components/LangSwitch";
import { GlobeMark, Logo } from "@/components/Logo";
import { getLang } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const c = landingCopy(await getLang());
  return { title: c.title, description: c.desc, openGraph: { title: c.title, description: c.desc, type: "website" } };
}

// one line icon per feature, same order as the copy
const ICONS = [
  "M4 5h16v11H4zM8 20h8M12 16v4M7 9h6M7 12h4", // NeST listing
  "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 15h6M10 18h3", // tender document
  "M5 6l2 2 3-3M5 12l2 2 3-3M5 18l2 2 3-3M13 7h6M13 13h6M13 19h6", // checklist
  "M4 7h16v13H4zM9 7V4h6v3M4 12h16", // vault
  "M4 19V9M10 19V5M16 19v-7M3 19h18", // pricing
  "M6 3h9l4 4v14H6zM9 14l2 2 4-4", // contract
  "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z", // supply
  "M3 6h18v12H3zM3 10h18M7 15h4", // invoices
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="lp-check">
      <path d="M5 10.5l3 3 7-7" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="lp-arrow">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function Pill({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={`lp-pill${dark ? " is-dark" : ""}`}>
      <i />
      {children}
    </span>
  );
}

export default async function Home() {
  const lang = await getLang();
  const c = landingCopy(lang);
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const start = user ? "/app" : "/login?mode=signup";

  return (
    <div className="lp">
      <div className="lp-navshell">
        <header className="lp-nav">
          <Link href="/" className="lp-brand" aria-label="Tenda Desk">
            <Logo height={26} />
            <span>
              <b>Tenda Desk</b>
              <small>{c.by}</small>
            </span>
          </Link>
          <nav className="lp-links" aria-label="Tenda Desk">
            <a href="#features">{c.nav.features}</a>
            <a href="#how">{c.nav.how}</a>
            <a href="#pricing">{c.nav.pricing}</a>
            <a href="#faq">{c.nav.faq}</a>
          </nav>
          <div className="lp-tools">
            <LangSwitch back="/" />
            {!user && (
              <Link href="/login" className="lp-login">
                {c.nav.login}
              </Link>
            )}
            <Link href={start} className="lp-btn lp-gold lp-sm">
              {user ? c.nav.open : c.nav.start}
            </Link>
          </div>
        </header>
      </div>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <Pill dark>{c.pill}</Pill>
              <h1>
                {c.h1a}
                <br />
                <span className="lp-goldtext">{c.h1b}</span>
              </h1>
              <p className="lp-lead">{c.lead}</p>
              <div className="lp-ctas">
                <Link href={start} className="lp-btn lp-gold">
                  {user ? c.nav.open : c.cta} <Arrow />
                </Link>
                <a href="#how" className="lp-btn lp-glass">
                  {c.cta2}
                </a>
              </div>
              <ul className="lp-trust">
                {c.trust.map((x) => (
                  <li key={x}>
                    <Check />
                    {x}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-stage" aria-hidden="true">
              <GlobeMark className="lp-orbit" />
              <div className="lp-mock">
                <div className="lp-mock-bar">
                  <i />
                  <i />
                  <i />
                  <span>exotender · Tenda Desk</span>
                </div>
                <div className="lp-mock-body">
                  <b className="lp-mock-h">{c.mock.title}</b>
                  {c.mock.rows.map(([title, stage, due, cls]) => (
                    <div key={title} className="lp-mock-row">
                      <span className="lp-mock-t">{title}</span>
                      <span className="lp-mock-stage">{stage}</span>
                      <span className={`lp-chip${cls ? ` is-${cls}` : ""}`}>{due}</span>
                    </div>
                  ))}
                  <div className="lp-mock-ai">
                    <div className="lp-mock-ai-h">
                      <span className="lp-spark">✦</span>
                      <span>
                        <b>{c.mock.claude}</b>
                        <small>{c.mock.found}</small>
                      </span>
                    </div>
                    {c.mock.docs.map(([d, ok]) => (
                      <div key={String(d)} className={`lp-mock-doc${ok ? " is-done" : ""}`}>
                        <span className="lp-box">{ok ? "✓" : ""}</span>
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lp-float lp-float-a">
                <span className="lp-float-ico is-bad">!</span>
                <span>
                  <b>{c.tagA[0]}</b>
                  <small>{c.tagA[1]}</small>
                </span>
              </div>
              <div className="lp-float lp-float-b">
                <span className="lp-float-ico is-ok">✓</span>
                <span>
                  <b>{c.tagB[0]}</b>
                  <small>{c.tagB[1]}</small>
                </span>
              </div>
            </div>
          </div>

          <div className="lp-wrap">
            <dl className="lp-stats">
              {c.stats.map(([n, label]) => (
                <div key={label}>
                  <dt>{n}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-track">
            {[...c.marquee, ...c.marquee].map((x, i) => (
              <span key={i}>
                {x}
                <i />
              </span>
            ))}
          </div>
        </div>

        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-head lp-rv">
              <Pill>{c.pills.pain}</Pill>
              <h2>{c.painH}</h2>
              <p>{c.painS}</p>
            </div>
            <div className="lp-pains">
              {c.pains.map(([h, problem, fix], i) => (
                <article key={h} className={`lp-pain lp-rv d${i}`}>
                  <span className="lp-pain-n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{h}</h3>
                  <p className="lp-problem">{problem}</p>
                  <p className="lp-fix">
                    <Check />
                    {fix}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-alt" id="features">
          <div className="lp-wrap">
            <div className="lp-head lp-rv">
              <Pill>{c.pills.feat}</Pill>
              <h2>{c.featH}</h2>
            </div>
            <div className="lp-bento">
              {c.feats.map(([h, p], i) => (
                <article key={h} className={`lp-feat lp-rv d${i % 4}${i === 1 ? " lp-star" : ""}`}>
                  <span className="lp-ico">
                    <Icon d={ICONS[i]} />
                  </span>
                  <h3>{h}</h3>
                  <p>{p}</p>
                  {i === 1 && (
                    <div className="lp-star-demo" aria-hidden="true">
                      {c.mock.docs.map(([d, ok]) => (
                        <span key={String(d)} className={ok ? "is-done" : ""}>
                          {ok ? "✓ " : "○ "}
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <div className="lp-head lp-rv">
              <Pill>{c.pills.how}</Pill>
              <h2>{c.howH}</h2>
              <p>{c.howS}</p>
            </div>
            <ol className="lp-stages lp-rv">
              {c.stages.map((s, i) => (
                <li key={s} className={i === 8 ? "done" : i >= 4 ? "won" : ""}>
                  <span>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <ol className="lp-steps">
              {c.steps.map(([h, p], i) => (
                <li key={h} className={`lp-rv d${i}`}>
                  <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec lp-dark">
          <div className="lp-wrap lp-team">
            <div className="lp-rv">
              <Pill dark>{c.pills.team}</Pill>
              <h2>{c.teamH}</h2>
              <p>{c.teamS}</p>
            </div>
            <ul className="lp-roles">
              {c.roles.map(([r, p], i) => (
                <li key={r} className={`lp-rv d${i}`}>
                  <span className="lp-role-n">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <b>{r}</b>
                    <small>{p}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <div className="lp-head lp-center lp-rv">
              <Pill>{c.pills.price}</Pill>
              <h2>{c.priceH}</h2>
              <p>{c.priceS}</p>
            </div>
            <div className="lp-plans">
              {c.plans.map(([name, price, per, tag], i) => (
                <article key={name} className={`lp-plan lp-rv d${i}${tag ? " lp-best" : ""}`}>
                  {tag && <span className="lp-tag">{tag}</span>}
                  <h3>{name}</h3>
                  <p className="lp-price">
                    <small>TSh</small> {price}
                  </p>
                  <p className="lp-per">{per}</p>
                  <ul>
                    {c.planIncl.map((x) => (
                      <li key={x}>
                        <Check />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <Link href={start} className={`lp-btn ${tag ? "lp-gold" : "lp-line"}`}>
                    {c.choose}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-alt" id="faq">
          <div className="lp-wrap lp-faqwrap">
            <div className="lp-head lp-rv">
              <Pill>{c.pills.faq}</Pill>
              <h2>{c.faqH}</h2>
            </div>
            <div className="lp-faq">
              {c.faqs.map(([q, a]) => (
                <details key={q} className="lp-rv">
                  <summary>
                    {q}
                    <i aria-hidden="true" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-endsec">
          <div className="lp-wrap">
            <div className="lp-end lp-rv">
              <GlobeMark className="lp-end-globe" />
              <h2>{c.endH}</h2>
              <p>{c.endS}</p>
              <Link href={start} className="lp-btn lp-gold">
                {user ? c.nav.open : c.cta} <Arrow />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <div className="lp-foot-brand">
            <Logo height={56} full />
            <p>{c.foot}</p>
          </div>
          <div>
            <h4>{c.product}</h4>
            <a href="#features">{c.nav.features}</a>
            <a href="#how">{c.nav.how}</a>
            <a href="#pricing">{c.nav.pricing}</a>
            <Link href="/login">{c.nav.login}</Link>
          </div>
          <div>
            <h4>{c.contact}</h4>
            <a href="tel:+255718367093">+255 718 367 093</a>
            <a href="mailto:exoglobal@gmail.com">exoglobal@gmail.com</a>
            <span>
              Natai Plaza, 17 Mikocheni,
              <br />
              Coca Cola Rd, Mwenge, Dar es Salaam
            </span>
          </div>
        </div>
        <div className="lp-wrap lp-copy">
          <span>
            © {new Date().getFullYear()} EXO Global Company Limited. {c.rights}
          </span>
          <span className="lp-motto">Tenda Desk · {c.by}</span>
        </div>
        <div className="lp-giant" aria-hidden="true">
          {c.giant}
        </div>
      </footer>
    </div>
  );
}
