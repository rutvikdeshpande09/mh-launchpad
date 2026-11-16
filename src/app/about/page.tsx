import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";
import { PILOT } from "@/lib/pilot";
import { QUOTES } from "@/lib/quotes";
import { listAllBusinesses } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About us | MH Launchpad",
  description:
    "MH Launchpad is a project by Mountain House High School students that helps home-based businesses get a free website and digital business card in their own language.",
};

const STEPS = [
  { n: "1", title: "A student interviews the owner", text: "A Tech Ambassador asks five simple questions. The owner can speak or type, in their own language." },
  { n: "2", title: "AI writes a private draft", text: "Google Gemini turns the answers into a bilingual website and a digital business card. Only the owner's private link can open it." },
  { n: "3", title: "The owner decides", text: "Nothing goes public until the owner approves it. They can hide it, or keep it off the homepage, any time." },
];

const PROMISES = [
  ["Private by default", "Every site starts as a private draft."],
  ["The owner approves", "Publishing is a separate, deliberate step."],
  ["No contact details online", "Street addresses and phone numbers are never published. Customers write through a masked form."],
  ["Only what owners told us", "The AI may use only facts the owner gave. No invented prices, awards or claims."],
];

export default async function AboutPage() {
  const all = (await listAllBusinesses()).filter((b) => !b.isDemo);
  const live = all.filter((b) => b.published).length;
  const stats: [string | number, string][] = [
    [PILOT.businessesCalled, "businesses called"],
    [PILOT.agreed, "said yes"],
    [live, "sites live, owner-approved"],
    [LANGUAGES.length, "languages supported"],
  ];

  return (
    <>
      {/* hero */}
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-16 text-center sm:pt-24">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-10 -z-10 size-72 rounded-full bg-cta/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 -z-10 size-72 rounded-full bg-[#7c5cff]/20 blur-3xl" />
        <Image src="/logo-icon.png" alt="" width={84} height={84} priority className="mx-auto size-20 rounded-2xl border-2 border-ink shadow-[4px_4px_0_var(--ink)]" />
        <p className="mt-6 text-sm font-bold uppercase tracking-widest text-brand">About us</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Students helping neighbors get a <span className="text-brand">front door online.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          We are Mountain House High School students. We built MH Launchpad so that home-based businesses can have a free website and a digital
          business card, in their own language, without needing money or design skills.
        </p>
      </section>

      {/* story */}
      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-[1fr_1.2fr] md:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Why we built it</p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight">Great local businesses were invisible online.</h2>
        </div>
        <div className="space-y-4 text-lg text-muted">
          <p>
            Home bakers, tutors, tailors and notary services rarely have a website. Building one takes time, money and design skills, and most
            tools assume the owner speaks English.
          </p>
          <p>
            So we picked up the phone. We called home-based business owners in Mountain House and asked what they needed. Then we built a tool where
            a student can interview an owner in their own language and have a professional page ready for them to review.
          </p>
        </div>
      </section>

      {/* numbers */}
      <section aria-label="Our numbers" className="mx-auto max-w-5xl px-4 py-6">
        <dl className="grid grid-cols-2 gap-4 rounded-2xl border-[1.5px] border-ink bg-ink p-6 text-background sm:grid-cols-4">
          {stats.map(([n, label]) => (
            <div key={label} className="text-center">
              <dd className="text-4xl font-black tabular-nums text-cta">{n}</dd>
              <dt className="mt-1 text-sm opacity-80">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-center text-xs text-muted">Our pilot in Mountain House, as of {PILOT.asOf}. Live sites are counted from our database.</p>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">How it works</p>
        <h2 className="mt-2 text-3xl font-extrabold">Three steps, one conversation.</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card relative p-6 pt-9 shadow-[4px_4px_0_var(--ink)]">
              <span className="absolute -top-5 left-5 grid size-10 place-items-center rounded-full border-2 border-ink bg-cta text-lg font-black">{s.n}</span>
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* quotes */}
      <section className="relative isolate overflow-hidden bg-ink px-4 py-20 text-background">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-cta/20 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold uppercase tracking-widest text-cta">In their words</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">What people told us.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {QUOTES.map((q, i) => (
              <figure key={i} className="flex flex-col rounded-2xl border-2 border-background/80 bg-background p-7 text-ink shadow-[6px_6px_0_var(--cta)]">
                <span aria-hidden className="font-serif text-7xl font-black leading-none text-brand">“</span>
                <blockquote className="-mt-3 flex-1 text-lg leading-relaxed">{q.text}</blockquote>
                <figcaption className="mt-5 border-t-2 border-line pt-3 text-sm font-semibold text-muted">{q.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* promises */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">Our promises</p>
        <h2 className="mt-2 text-3xl font-extrabold">Built so owners stay in control.</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {PROMISES.map(([t, d]) => (
            <li key={t} className="card flex gap-4 p-5">
              <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-cta font-black">✓</span>
              <div>
                <h3 className="font-bold">{t}</h3>
                <p className="mt-1 text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* team */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="card p-8 text-center shadow-[4px_4px_0_var(--ink)]">
          <h2 className="text-2xl font-extrabold">Built by Rutvik and Ritvik</h2>
          <p className="mt-3 text-muted">
            Two students at Mountain House High School. We used Next.js, Google Gemini, Supabase and Vercel, and every site is written from what the owner told us.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/#explore" className="btn btn-primary">See live examples</Link>
            <Link href="/owner" className="btn btn-ghost">I own a business</Link>
            <a href="https://github.com/rutvikdeshpande09/mh-launchpad" className="btn btn-ghost" target="_blank" rel="noreferrer">View the code</a>
          </div>
        </div>
      </section>
    </>
  );
}
