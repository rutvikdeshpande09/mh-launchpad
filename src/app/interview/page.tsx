"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import { QUESTIONS } from "@/lib/content";
import { LANGUAGES } from "@/lib/languages";
import { postJson, resizeImage, useAmbassador, type AudioClip } from "@/lib/client";

interface AnswerState {
  text: string;
  audio: AudioClip | null;
}

export default function InterviewPage() {
  const { session, ready } = useAmbassador();
  const [language, setLanguage] = useState("en");
  const [altLanguage, setAltLanguage] = useState("es");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<AnswerState[]>(QUESTIONS.map(() => ({ text: "", audio: null })));
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ slug: string; certificateId: string } | null>(null);

  if (!ready) return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="mt-4 text-2xl font-extrabold">Tech Ambassadors only</h1>
        <p className="mt-2 text-muted">Pass the quick skill check (or use judge demo access) to unlock interviews.</p>
        <Link href="/ambassador" className="btn btn-primary mt-6">Go to Ambassador sign-up</Link>
      </div>
    );
  }

  const spoken = LANGUAGES.find((l) => l.code === language)!;
  const effectiveAlt = language === "en" ? altLanguage : language;
  const complete = answers.every((a) => a.text.trim() || a.audio) && consent && /\S+@\S+\.\S+/.test(ownerEmail);

  const setAnswer = (i: number, patch: Partial<AnswerState>) => setAnswers((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  async function addPhotos(files: FileList | null) {
    if (!files || !session) return;
    setUploading(true);
    setError("");
    try {
      for (const file of [...files].slice(0, 3 - photos.length)) {
        const dataUrl = await resizeImage(file, 900, 0.8);
        const { url } = await postJson<{ url: string }>("/api/upload", { dataUrl }, { "x-ambassador-token": session.token });
        setPhotos((p) => [...p, url].slice(0, 3));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const res = await postJson<{ slug: string; certificateId: string }>("/api/generate-site", {
        token: session.token,
        language,
        altLanguage: effectiveAlt,
        ownerEmail: ownerEmail.trim(),
        consent: true,
        photos,
        answers: answers.map((a) => ({
          ...(a.text.trim() ? { text: a.text.trim() } : {}),
          ...(a.audio ? { audio: { data: a.audio.data, mimeType: a.audio.mimeType } } : {}),
        })),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-6xl">🎉</p>
        <h1 className="mt-4 text-3xl font-extrabold">The site is live!</h1>
        <p className="mt-2 text-muted">Your certificate is ready too. Share these links with the business owner.</p>
        <div className="mt-8 grid gap-3">
          <Link href={`/sites/${result.slug}`} className="btn btn-primary">View the new website</Link>
          <Link href={`/certificate/${result.certificateId}`} className="btn btn-ghost">🏅 View your service certificate</Link>
          <Link href={`/manage/${result.slug}`} className="btn btn-ghost">Owner portal (for the business owner)</Link>
        </div>
        <p className="mt-6 text-sm text-muted">
          Owner portal link to share: <code className="break-all">/manage/{result.slug}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Interview studio</h1>
      <p className="mt-2 text-muted">
        Hi {session.name}! Ask the owner each question. They can speak (record a voice answer) or you can type what they say.
      </p>

      <section className="card mt-8 space-y-4 p-6">
        <h2 className="font-bold">1. Before you start</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Language of the interview
            <select className="field mt-1" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.native})
                </option>
              ))}
            </select>
          </label>
          {language === "en" ? (
            <label className="block text-sm font-semibold">
              Second language for the site
              <select className="field mt-1" value={altLanguage} onChange={(e) => setAltLanguage(e.target.value)}>
                <option value="en">English only</option>
                {LANGUAGES.filter((l) => l.code !== "en").map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="self-end text-sm text-muted">The site will be in English and {spoken.label}.</p>
          )}
        </div>
        <label className="block text-sm font-semibold">
          Owner&apos;s email (so they can manage their site)
          <input type="email" className="field mt-1" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={120} />
          <span className="mt-1 block text-xs font-normal text-muted">Used only for owner login. It is never shown on the public site.</span>
        </label>
        <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            The business owner agreed to be interviewed, to have their answers processed by AI (Google Gemini), and to have a public
            website made about their business. <strong>No street address or phone number will be published.</strong>
          </span>
        </label>
      </section>

      <section className="mt-6 space-y-4">
        {QUESTIONS.map((q, i) => (
          <div key={i} className="card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Question {i + 1} of 5</p>
            <p className="mt-1 font-semibold">{q}</p>
            <textarea
              className="field mt-3"
              rows={3}
              maxLength={1500}
              value={answers[i].text}
              onChange={(e) => setAnswer(i, { text: e.target.value })}
              placeholder={`Type the answer in ${spoken.label}…`}
              lang={language}
            />
            <div className="mt-3">
              <AudioRecorder value={answers[i].audio} onChange={(audio) => setAnswer(i, { audio })} disabled={busy} />
            </div>
          </div>
        ))}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-bold">Product photos (optional, up to 3)</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Product photo ${i + 1}`} className="size-24 rounded-xl object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-black text-white"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-brand">
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} disabled={uploading} />
            </label>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary mt-6 w-full !py-3 text-lg" disabled={!complete || busy || uploading} onClick={generate}>
        {busy ? (
          <>
            <Loader2 className="animate-spin" /> Building the website… this can take 20–40 seconds
          </>
        ) : (
          "✨ Generate the website"
        )}
      </button>
      {!complete && <p className="mt-2 text-center text-xs text-muted">Answer all 5 questions, add the owner&apos;s email, and confirm consent to continue.</p>}
    </div>
  );
}
