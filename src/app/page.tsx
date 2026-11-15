import Image from "next/image";
import Link from "next/link";
import { PILOT } from "@/lib/pilot";
import { listAllBusinesses, listBusinesses } from "@/lib/store";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: "🎓", title: "Students earn a badge", text: "High schoolers pass a 60-second AI-graded skill check to become Tech Ambassadors." },
  { icon: "🎙️", title: "A 5-question interview", text: "Speak or type with a home-based owner in English, Telugu, Punjabi, Hindi, Spanish, Mandarin or Tagalog." },
  { icon: "✨", title: "AI builds the site", text: "Gemini turns the interview into a bilingual 3D website and a shareable digital business card." },
  { icon: "🏅", title: "Everyone gains", text: "Owners get an online home. Students get a certificate for their service hours." },
];

export default async function Home() {
  const businesses = await listBusinesses();
  const all = (await listAllBusinesses()).filter((b) => !b.isDemo);
  const builtReal = all.length; // includes private drafts
  const liveReal = all.filter((b) => b.published).length; // owner-approved, including ones kept off the homepage
  return (
    <>
      <section className="relative isolate overflow-hidden px-4 pb-24 pt-16 text-center">
        {/* orbit rings: decorative only */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
          <g className="orbit" opacity="0.9">
            <ellipse cx="600" cy="380" rx="520" ry="250" fill="none" stroke="#15120e" strokeOpacity="0.32" strokeDasharray="3 9" transform="rotate(-14 600 380)" />
            <circle cx="1118" cy="318" r="9" fill="#ff6a13" />
            <circle cx="1118" cy="318" r="16" fill="#ff6a13" fillOpacity="0.18" />
          </g>
          <g className="orbit-rev" opacity="0.9">
            <ellipse cx="600" cy="380" rx="400" ry="190" fill="none" stroke="#15120e" strokeOpacity="0.26" transform="rotate(18 600 380)" />
            <circle cx="214" cy="470" r="7" fill="#15120e" fillOpacity="0.7" />
            <circle cx="990" cy="288" r="5" fill="#8b78ff" />
          </g>
        </svg>
        <Image
          src="/logo.png"
          alt="MH Launchpad logo: a graduate in a cap reaching for a star"
          width={800}
          height={590}
          priority
          className="mx-auto mb-8 w-56 rounded-2xl border-2 border-ink shadow-[4px_4px_0_var(--ink)] sm:w-64"
        />
        <p className="mx-auto w-fit rounded-full border-2 border-ink bg-surface px-4 py-1 text-sm font-bold text-ink">
          A Mountain House High School project
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Every neighbor&apos;s business deserves a <span className="text-brand">front door</span> online.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Home bakers, tutors, tailors and notary services rarely have a website. MH Launchpad lets Mountain House High School students
          interview them in their own language and launch a free site and digital business card in minutes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/owner" className="btn btn-primary">I own a business</Link>
          <Link href="/ambassador" className="btn btn-ghost">I&apos;m a student ambassador</Link>
          <Link href="#explore" className="btn btn-ghost">See live examples</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card p-6">
            <p className="text-3xl">{s.icon}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-brand">Step {i + 1}</p>
            <h2 className="mt-1 text-lg font-bold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.text}</p>
          </div>
        ))}
      </section>

      <section aria-label="Pilot results" className="mx-auto mt-10 max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl border-[1.5px] border-ink bg-ink px-6 py-5 text-background">
          <p className="text-sm font-bold uppercase tracking-widest text-cta">Our pilot in Mountain House · as of {PILOT.asOf}</p>
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            {[
              [PILOT.businessesCalled, "businesses called"],
              [PILOT.agreed, "said yes"],
              [builtReal, "sites built"],
              [liveReal, "live, owner-approved"],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="text-sm opacity-80">{label}</dt>
                <dd className="text-3xl font-black tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-extrabold">Local businesses on MH Launchpad</h2>
        <p className="mt-2 text-muted">Real home-based businesses, each launched by a student ambassador and approved by its owner.</p>
        {businesses.length === 0 && (
          <div className="card mt-8 p-8 text-center">
            <p className="text-4xl">🌱</p>
            <p className="mt-2 font-bold">The first sites are on their way</p>
            <p className="mt-1 text-sm text-muted">Owners approve their page before it appears here.</p>
          </div>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link
              key={b.slug}
              href={`/sites/${b.slug}`}
              className="card group overflow-hidden transition hover:-translate-y-1"
            >
              <div
                className="grid h-32 place-items-center text-6xl"
                style={{ background: `linear-gradient(135deg, ${b.content.theme.primary}, ${b.content.theme.accent})` }}
              >
                {b.content.theme.emoji}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold group-hover:underline">{b.content.businessName}</h3>
                  {b.isDemo && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">Demo</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{b.content.tagline.en}</p>
                {b.altLang.code !== "en" && <p className="mt-3 text-xs font-semibold text-ink">English + {b.altLang.label}</p>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24">
        <div className="card p-8">
          <h2 className="text-2xl font-extrabold">Judges: a 3-minute tour</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
            <li>Open a site under <a href="#explore" className="font-semibold text-brand underline">Explore</a>. Try the language toggle, the 3D cards and the flip-able business card.</li>
            <li>
              On <Link href="/ambassador" className="font-semibold text-brand underline">Ambassadors</Link>, choose <strong>Judge demo access</strong> and save a
              public profile (languages and a short bio).
            </li>
            <li>
              Open <Link href="/owner" className="font-semibold text-brand underline">For businesses</Link> in a private window, choose{" "}
              <strong>Demo owner access</strong>, enter a business name, pick your ambassador and send the request.
            </li>
            <li>
              Back as the ambassador, <strong>accept</strong> the request and press <strong>Start the interview</strong>. Type short answers (or record your
              voice), add an optional custom request, and generate a private <em>draft</em>.
            </li>
            <li>
              Press <strong>Approve &amp; publish</strong>, then open <Link href="/creations" className="font-semibold text-brand underline">My creations</Link>{" "}
              to <strong>Edit</strong> the text, change colours, or tell the AI &ldquo;Sold out of X, add Y for $5.&rdquo;
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
