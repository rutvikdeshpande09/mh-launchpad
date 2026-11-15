"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/client";
import type { AltLang, BiText, SiteContent } from "@/lib/schemas";
import { useOwnerSession } from "@/lib/useOwnerSession";

type Service = SiteContent["services"][number];
const blankBi = (): BiText => ({ en: "", alt: "" });
const blankService = (): Service => ({ name: blankBi(), description: blankBi(), price: "", emoji: "✨" });

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** One English field, plus the second-language field for bilingual sites. */
function BiField({
  label, value, onChange, bilingual, altLabel, multiline, max,
}: {
  label: string; value: BiText; onChange: (v: BiText) => void; bilingual: boolean; altLabel: string; multiline?: boolean; max: number;
}) {
  const Input = multiline ? "textarea" : "input";
  const extra = multiline ? { rows: 3 } : {};
  return (
    <div className={`grid gap-3 ${bilingual ? "sm:grid-cols-2" : ""}`}>
      <label className="block text-sm font-semibold">
        {label}
        <Input className="field mt-1" value={value.en} maxLength={max} onChange={(e) => onChange({ ...value, en: e.target.value })} {...extra} />
      </label>
      {bilingual && (
        <label className="block text-sm font-semibold">
          {label} <span className="font-normal text-muted">({altLabel})</span>
          <Input className="field mt-1" value={value.alt} maxLength={max} onChange={(e) => onChange({ ...value, alt: e.target.value })} {...extra} />
        </label>
      )}
    </div>
  );
}

export default function EditorClient({ slug }: { slug: string }) {
  const draft = useSearchParams().get("draft") ?? "";
  const { auth, ready, headers: ownerHeaders, startDemo } = useOwnerSession();
  const [content, setContent] = useState<SiteContent | null>(null);
  const [altLang, setAltLang] = useState<AltLang>({ code: "en", label: "English" });
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const ownerKey = auth ? (auth.kind === "demo" ? "demo" : auth.token) : "";
  const headers = useMemo(() => ({ ...(draft ? { "x-draft-token": draft } : {}), ...ownerHeaders() }), [draft, ownerHeaders]);

  useEffect(() => {
    if (!ready) return;
    if (!draft && !ownerKey) return; // nothing to authorise with yet
    let cancelled = false;
    fetch(`/api/site?slug=${encodeURIComponent(slug)}`, { headers })
      .then(async (r) => {
        if (cancelled) return;
        const d = (await r.json().catch(() => ({}))) as { content?: SiteContent; altLang?: AltLang; published?: boolean; error?: string };
        if (!r.ok || !d.content) {
          setLoadFailed(true);
          setError(d.error ?? "Could not load this site.");
        } else {
          setContent(d.content);
          setAltLang(d.altLang ?? { code: "en", label: "English" });
          setPublished(Boolean(d.published));
          setLoadFailed(false);
          setError("");
        }
      })
      .catch(() => !cancelled && setError("Could not load this site."));
    return () => {
      cancelled = true;
    };
  }, [ready, slug, draft, ownerKey, headers]);

  if (!ready) return null;

  if (!content) {
    const needsSignIn = !draft && !ownerKey;
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold">Edit your site</h1>
        {needsSignIn ? (
          <>
            <p className="mt-2 text-muted">Sign in as the business owner to edit this site, or use the private draft link from the ambassador.</p>
            <div className="mt-6 grid gap-3">
              <Link href={`/manage/${slug}`} className="btn btn-primary">Owner sign-in</Link>
              <button type="button" className="btn btn-ghost" onClick={startDemo}>🎟️ Demo owner access (judges)</button>
            </div>
          </>
        ) : loadFailed ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error} Published sites can only be edited by their owner.
          </p>
        ) : (
          <Loader2 className="mx-auto mt-6 animate-spin" />
        )}
      </div>
    );
  }

  const bilingual = altLang.code !== "en";
  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => {
    setContent((c) => (c ? { ...c, [k]: v } : c));
    setSaved(false);
  };
  const setService = (i: number, patch: Partial<Service>) => set("services", content.services.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const valid =
    content.businessName.trim() && content.tagline.en.trim() && content.about.en.trim() &&
    content.services.length >= 1 && content.services.every((s) => s.name.en.trim()) &&
    content.highlights.length >= 2 && content.highlights.every((h) => h.en.trim());

  async function save() {
    if (!content) return;
    setBusy(true);
    setError("");
    try {
      const res = await postJson<{ content: SiteContent }>("/api/site", { slug, content }, headers);
      setContent(res.content);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const viewHref = published ? `/sites/${slug}` : `/sites/${slug}?preview=${draft}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Edit {content.businessName}</h1>
          <p className="text-sm text-muted">{published ? "Public site" : "Draft"} · changes show on the site as soon as you save.</p>
        </div>
        <Link href={viewHref} className="btn btn-ghost !py-2 text-sm">View the site</Link>
      </div>

      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Don&apos;t put phone numbers, emails or a street address here. Pages are public, and customers can reach you privately through the message form.
        {bilingual && ` This site is in English and ${altLang.label}. If you change the English, update the ${altLang.label} text too.`}
      </p>

      <section className="card mt-6 space-y-4 p-6">
        <h2 className="font-bold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Business name
            <input className="field mt-1" value={content.businessName} maxLength={80} onChange={(e) => set("businessName", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Category
            <input className="field mt-1" value={content.category} maxLength={60} onChange={(e) => set("category", e.target.value)} />
          </label>
        </div>
        <BiField label="Tagline" value={content.tagline} onChange={(v) => set("tagline", v)} bilingual={bilingual} altLabel={altLang.label} max={140} />
        <BiField label="About us" value={content.about} onChange={(v) => set("about", v)} bilingual={bilingual} altLabel={altLang.label} max={700} multiline />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Service area (a city or neighborhood only)
            <input className="field mt-1" value={content.serviceArea} maxLength={80} onChange={(e) => set("serviceArea", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Business card tagline
            <input className="field mt-1" value={content.cardTagline} maxLength={70} onChange={(e) => set("cardTagline", e.target.value)} />
          </label>
        </div>
        <BiField label="Hours" value={content.hours} onChange={(v) => set("hours", v)} bilingual={bilingual} altLabel={altLang.label} max={120} />
        <BiField label="Notice for customers (leave empty for none)" value={content.announcement} onChange={(v) => set("announcement", v)} bilingual={bilingual} altLabel={altLang.label} max={200} />
      </section>

      <section className="card mt-6 space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">What you offer ({content.services.length}/8)</h2>
          <button type="button" className="btn btn-ghost !py-1.5 text-sm" disabled={content.services.length >= 8} onClick={() => set("services", [...content.services, blankService()])}>
            <Plus size={16} /> Add item
          </button>
        </div>
        {content.services.map((s, i) => (
          <div key={i} className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">Item {i + 1}</p>
              <div className="flex gap-1">
                <button type="button" aria-label="Move up" className="btn btn-ghost !p-1.5" disabled={i === 0} onClick={() => set("services", move(content.services, i, -1))}><ArrowUp size={14} /></button>
                <button type="button" aria-label="Move down" className="btn btn-ghost !p-1.5" disabled={i === content.services.length - 1} onClick={() => set("services", move(content.services, i, 1))}><ArrowDown size={14} /></button>
                <button type="button" aria-label="Remove item" className="btn btn-ghost !p-1.5" disabled={content.services.length <= 1} onClick={() => set("services", content.services.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
                <label className="block text-sm font-semibold">
                  Emoji
                  <input className="field mt-1 text-center" value={s.emoji} maxLength={8} onChange={(e) => setService(i, { emoji: e.target.value })} />
                </label>
                <label className="block text-sm font-semibold">
                  Price
                  <input className="field mt-1" value={s.price} maxLength={40} onChange={(e) => setService(i, { price: e.target.value })} placeholder="$10 or Ask for a quote" />
                </label>
              </div>
              <BiField label="Name" value={s.name} onChange={(v) => setService(i, { name: v })} bilingual={bilingual} altLabel={altLang.label} max={80} />
              <BiField label="Description" value={s.description} onChange={(v) => setService(i, { description: v })} bilingual={bilingual} altLabel={altLang.label} max={260} multiline />
            </div>
          </div>
        ))}
      </section>

      <section className="card mt-6 space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">Highlights ({content.highlights.length}/4, at least 2)</h2>
          <button type="button" className="btn btn-ghost !py-1.5 text-sm" disabled={content.highlights.length >= 4} onClick={() => set("highlights", [...content.highlights, blankBi()])}>
            <Plus size={16} /> Add
          </button>
        </div>
        {content.highlights.map((h, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <BiField label={`Highlight ${i + 1}`} value={h} onChange={(v) => set("highlights", content.highlights.map((x, j) => (j === i ? v : x)))} bilingual={bilingual} altLabel={altLang.label} max={120} />
            </div>
            <button type="button" aria-label="Remove highlight" className="btn btn-ghost !p-2.5" disabled={content.highlights.length <= 2} onClick={() => set("highlights", content.highlights.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {saved && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">✅ Saved. <Link href={viewHref} className="font-semibold underline">View the site</Link></p>}

      <div className="sticky bottom-3 mt-6 flex justify-end">
        <button type="button" className="btn btn-primary !py-3 text-base" disabled={busy || !valid} onClick={save}>
          {busy && <Loader2 className="animate-spin" size={16} />} Save changes
        </button>
      </div>
      {!valid && <p className="mt-2 text-right text-xs text-muted">Fill in the name, tagline, about text, every item name and at least 2 highlights.</p>}
    </div>
  );
}
