import Link from "next/link";
import { listBusinesses } from "@/lib/store";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: "🎓", title: "Students earn a badge", text: "High schoolers pass a 60-second AI-graded skill check to become Tech Ambassadors." },
  { icon: "🎙️", title: "A 5-question interview", text: "Speak or type with a home-based owner in English, Telugu, Punjabi, Hindi, Spanish, Mandarin or Tagalog." },
  { icon: "✨", title: "AI builds the site", text: "Gemini turns the interview into a bilingual 3D website and a shareable digital business card." },
  { icon: "🏅", title: "Everyone gains", text: "Owners get an online home. Students get a certificate for their service hours." },
];

export default async function Home() {
  const businesses = await listBusinesses();
  return (
    <>
      <section className="relative isolate overflow-hidden px-4 pb-24 pt-16 text-center">
        <div className="floaty absolute -left-20 top-0 -z-10 size-72 rounded-full bg-brand/10" />
        <div className="floaty absolute -right-16 bottom-0 -z-10 size-80 rounded-[40%] bg-brand-2/10" />
        <p className="mx-auto w-fit rounded-full border border-line bg-white px-4 py-1 text-sm font-semibold text-brand">
          Rotary AI for Good · Create Lasting Impact
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Every neighbor&apos;s business deserves a <span className="text-brand">front door</span> online.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Home bakers, tutors, tailors and henna artists rarely have a website. MH Launchpad lets Mountain House High School students
          interview them in their own language and launch a free site and digital business card in minutes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/ambassador" className="btn btn-primary">Become a Tech Ambassador</Link>
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

      <section id="explore" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-extrabold">Local businesses on MH Launchpad</h2>
        <p className="mt-2 text-muted">The first one is a fictional demo so you can explore right away.</p>
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
                {b.altLang.code !== "en" && <p className="mt-3 text-xs font-semibold text-brand-2">English + {b.altLang.label}</p>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24">
        <div className="card p-8">
          <h2 className="text-2xl font-extrabold">Judges: a 2-minute tour</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
            <li>Open a demo site above. Try the language toggle, the 3D cards and the flip-able business card.</li>
            <li>
              Go to <Link href="/ambassador" className="font-semibold text-brand underline">Ambassador</Link> and choose{" "}
              <strong>Judge demo access</strong>.
            </li>
            <li>
              Run the <Link href="/interview" className="font-semibold text-brand underline">interview</Link> (typing is fine) to
              generate a brand-new <em>draft</em> site and a service certificate, then press <strong>Approve &amp; publish</strong> to make it public.
            </li>
            <li>
              Open <Link href="/manage/tamales-la-abuela" className="font-semibold text-brand underline">the owner portal</Link>,
              choose <strong>Demo owner access</strong>, and tell the AI &ldquo;Sold out of chicken tamales this weekend, add Atole for $5.&rdquo;
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
