"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Clock, Languages, MapPin, Send } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { BiText, Business } from "@/lib/schemas";
import { RTL_LANGUAGES } from "@/lib/languages";
import { EN, getStrings } from "@/lib/ui-strings";
import { postJson } from "@/lib/client";
import BusinessCard3D, { buildCardData } from "./BusinessCard3D";
import Tilt from "./Tilt";

type Lang = "en" | "alt";

export default function SiteView({ business, preview = false }: { business: Business; preview?: boolean }) {
  const { content: c, altLang } = business;
  const bilingual = altLang.code !== "en";
  const [lang, setLang] = useState<Lang>("en");
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const shapeY1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const shapeY2 = useTransform(scrollYProgress, [0, 1], [0, 90]);

  const t = (b: BiText) => (lang === "alt" && b.alt ? b.alt : b.en);
  const s = lang === "alt" ? getStrings(altLang.code) : EN;
  const { primary, accent } = c.theme;
  const langAttr = lang === "alt" ? altLang.code : "en";
  const hasAnnouncement = Boolean(t(c.announcement).trim());

  return (
    <div
      lang={langAttr}
      dir={RTL_LANGUAGES.includes(langAttr) ? "rtl" : "ltr"}
      className="overflow-x-clip bg-[#fffaf3]"
      style={{
        backgroundImage: `radial-gradient(40rem 30rem at 4% 40%, ${primary}38, transparent 65%), radial-gradient(40rem 30rem at 98% 62%, ${accent}38, transparent 65%), radial-gradient(44rem 30rem at 10% 96%, ${primary}26, transparent 65%)`,
      }}
    >
      {/* ---------- hero ---------- */}
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden px-4 pb-28 pt-14 text-white sm:pt-20"
        style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
      >
        <motion.div style={reduce ? undefined : { y: shapeY1 }} className="floaty absolute -left-16 top-10 size-64 rounded-full bg-white/10 blur-[1px]" />
        <motion.div style={reduce ? undefined : { y: shapeY2 }} className="floaty absolute -right-10 bottom-10 size-80 rounded-[40%] bg-black/10" />
        <div className="absolute right-[12%] top-12 hidden size-24 rotate-12 rounded-3xl border-4 border-white/20 md:block" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="rounded-full bg-white/20 px-3 py-1">{c.category}</span>
              {business.isDemo && <span className="rounded-full bg-black/30 px-3 py-1">Demo business</span>}
              {bilingual && (
                <button
                  type="button"
                  onClick={() => setLang((l) => (l === "en" ? "alt" : "en"))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-black shadow"
                  aria-label={`Switch language to ${lang === "en" ? altLang.label : "English"}`}
                >
                  <Languages size={15} /> {lang === "en" ? altLang.label : "English"}
                </button>
              )}
            </div>
            {c.brand?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.brand.logoUrl} alt={`${c.businessName} logo`} className="mb-5 h-16 w-auto max-w-[12rem] rounded-xl bg-white/95 object-contain p-2 shadow-lg" />
            )}
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-black leading-tight tracking-tight sm:text-6xl"
            >
              {c.businessName}
            </motion.h1>
            <p className="mt-4 max-w-xl text-lg text-white/90 sm:text-xl">{t(c.tagline)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className="btn bg-white text-black shadow-lg">
                <Send size={16} /> {s.message}
              </a>
              <a href="#card" className="btn border border-white/60 text-white">
                {c.theme.emoji} {s.card}
              </a>
            </div>
          </div>

          <Tilt max={14} className="mx-auto w-full max-w-sm">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-[2rem] border border-white/30 bg-white/15 shadow-2xl backdrop-blur">
              {business.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.photos[0]} alt={`${c.businessName} product`} className="size-full object-cover" />
              ) : (
                <span className="text-[9rem] drop-shadow-xl" aria-hidden>
                  {c.theme.emoji}
                </span>
              )}
            </div>
          </Tilt>
        </div>

        {/* flowy wave divider */}
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[-1px] h-20 w-full" aria-hidden>
          <path fill="#fffaf3" d="M0,64 C240,120 480,0 720,48 C960,96 1200,120 1440,40 L1440,120 L0,120 Z" />
        </svg>
      </section>

      {/* ---------- announcement ---------- */}
      {hasAnnouncement && (
        <div className="relative z-10 mx-auto mt-8 max-w-3xl px-4">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="rounded-2xl border-2 bg-white px-5 py-3 text-center font-semibold shadow-lg"
            style={{ borderColor: accent, color: accent }}
          >
            📣 {t(c.announcement)}
          </motion.div>
        </div>
      )}

      {/* ---------- about ---------- */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-3xl font-extrabold" style={{ color: primary }}>
          {s.about}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#3b4252]">{t(c.about)}</p>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {c.highlights.map((h, i) => (
            <motion.li
              key={i}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-full px-4 py-2 text-sm font-bold text-white shadow"
              style={{ background: i % 2 ? accent : primary }}
            >
              ✓ {t(h)}
            </motion.li>
          ))}
        </ul>
      </section>

      {/* ---------- services ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-center text-3xl font-extrabold" style={{ color: primary }}>
          {s.offer}
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.services.map((svc, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.5 }}
            >
              <Tilt max={9}>
                <article className="card flex h-full flex-col p-6" style={{ borderTop: `5px solid ${i % 2 ? accent : primary}` }}>
                  <div
                    className="grid size-16 place-items-center rounded-2xl text-4xl shadow-inner"
                    style={{ background: `${i % 2 ? accent : primary}1a`, transform: "translateZ(30px)" }}
                    aria-hidden
                  >
                    {svc.emoji}
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{t(svc.name)}</h3>
                  <p className="mt-2 flex-1 text-[#4b5263]">{t(svc.description)}</p>
                  <p className="mt-4 text-lg font-extrabold" style={{ color: i % 2 ? accent : primary }}>
                    {svc.price}
                  </p>
                </article>
              </Tilt>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm font-semibold text-[#3b4252]">
          <span className="card flex items-center gap-2 px-4 py-2">
            <Clock size={16} style={{ color: primary }} /> {s.hours}: {t(c.hours)}
          </span>
          <span className="card flex items-center gap-2 px-4 py-2">
            <MapPin size={16} style={{ color: primary }} /> {s.area}: {c.serviceArea}
          </span>
        </div>
      </section>

      {/* ---------- gallery ---------- */}
      {business.photos.length > 1 && (
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2">
          {business.photos.slice(1).map((p, i) => (
            <Tilt key={i} max={6}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`${c.businessName} photo ${i + 2}`} className="aspect-video w-full rounded-2xl object-cover shadow-lg" />
            </Tilt>
          ))}
        </section>
      )}

      {/* ---------- digital card ---------- */}
      <section id="card" className="px-4 py-16" style={{ background: `${accent}12` }}>
        <h2 className="mb-8 text-center text-3xl font-extrabold" style={{ color: accent }}>
          {s.card}
        </h2>
        <BusinessCard3D data={buildCardData(c, { slug: business.slug, avatarUrl: business.avatarUrl, primary: primary, accent: accent })} />
      </section>

      {/* ---------- masked inquiry form ---------- */}
      <section id="contact" className="mx-auto max-w-xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold" style={{ color: primary }}>
          {s.message}
        </h2>
        <InquiryForm slug={business.slug} s={s} color={primary} disabled={preview} />
      </section>

      <footer className="border-t border-black/5 px-4 py-8 text-center text-sm text-[#5b6270]">
        Website created by Tech Ambassador <strong>{business.ambassadorName || "a student"}</strong> with{" "}
        <Link href="/" className="underline">
          MH Launchpad
        </Link>
        . The owner&apos;s contact details stay private.
      </footer>
    </div>
  );
}

function InquiryForm({ slug, s, color, disabled }: { slug: string; s: typeof EN; color: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    try {
      await postJson("/api/inquiry", {
        slug,
        name: f.get("name"),
        contact: f.get("contact"),
        message: f.get("message"),
        website: f.get("website"), // honeypot
      });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="card mt-8 p-6 text-center font-semibold" style={{ color }}>
        ✅ {s.sent}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
      <label className="block text-sm font-semibold">
        {s.yourName}
        <input name="name" required maxLength={60} className="field mt-1" />
      </label>
      <label className="block text-sm font-semibold">
        {s.reach}
        <input name="contact" required maxLength={120} className="field mt-1" />
      </label>
      <label className="block text-sm font-semibold">
        {s.message}
        <textarea name="message" required rows={4} maxLength={800} className="field mt-1" />
      </label>
      {/* honeypot field: hidden from people, tempting to bots */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" className="btn w-full text-white" style={{ background: color }} disabled={state === "sending" || disabled}>
        <Send size={16} /> {state === "sending" ? "…" : s.send}
      </button>
    </form>
  );
}
