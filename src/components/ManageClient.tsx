"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Camera, ExternalLink, Loader2, LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { Business, Inquiry } from "@/lib/schemas";
import { postJson, type AudioClip } from "@/lib/client";
import AudioRecorder from "./AudioRecorder";
import BusinessCard3D from "./BusinessCard3D";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(SUPA_URL && SUPA_ANON);

type Auth = { kind: "demo" } | { kind: "supabase"; token: string; email: string };

const EXAMPLES = [
  "Sold out of samosas this weekend, add Mango Lassi for $5",
  "We are closed next Monday for a family event",
  "Change our hours to weekdays after 5pm",
];

async function cropToDataUrl(src: string, area: Area): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export default function ManageClient({ initial }: { initial: Business }) {
  const [business, setBusiness] = useState(initial);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [checking, setChecking] = useState(hasSupabase);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [audio, setAudio] = useState<AudioClip | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  // photo cropping
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  const supabase: SupabaseClient | null = useMemo(
    () => (hasSupabase ? createClient(SUPA_URL!, SUPA_ANON!) : null),
    [],
  );
  const canUseDemo = initial.isDemo || !hasSupabase;

  const headers = useCallback((): Record<string, string> => {
    if (!auth) return {};
    return auth.kind === "demo" ? { "x-demo-owner": "1" } : { authorization: `Bearer ${auth.token}` };
  }, [auth]);

  // restore an existing magic-link session
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s?.user.email) setAuth({ kind: "supabase", token: s.access_token, email: s.user.email });
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user.email) setAuth({ kind: "supabase", token: s.access_token, email: s.user.email });
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Load the private inbox whenever the owner signs in.
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    fetch(`/api/manage?slug=${encodeURIComponent(business.slug)}`, { headers: headers() })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setAuth(null);
          setMessage({ kind: "err", text: "That account doesn't own this business. Sign in with the owner's email." });
        } else if (res.ok) {
          setInquiries(((await res.json()) as { inquiries: Inquiry[] }).inquiries);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth, business.slug, headers]);

  async function sendLink() {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/manage/${business.slug}` },
    });
    setBusy(false);
    if (error) setMessage({ kind: "err", text: error.message });
    else setLinkSent(true);
  }

  async function applyUpdate() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<{ content: Business["content"]; changeSummary: string }>(
        "/api/update-site",
        {
          slug: business.slug,
          ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
          ...(audio ? { audio: { data: audio.data, mimeType: audio.mimeType } } : {}),
        },
        headers(),
      );
      setBusiness((b) => ({ ...b, content: res.content }));
      setInstruction("");
      setAudio(null);
      setMessage({ kind: "ok", text: `✅ ${res.changeSummary}` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Update failed." });
    } finally {
      setBusy(false);
    }
  }

  async function saveAvatar() {
    if (!cropSrc || !area) return;
    setBusy(true);
    try {
      const dataUrl = await cropToDataUrl(cropSrc, area);
      const res = await postJson<{ avatarUrl: string }>("/api/manage", { slug: business.slug, action: "avatar", dataUrl }, headers());
      setBusiness((b) => ({ ...b, avatarUrl: res.avatarUrl }));
      setCropSrc(null);
      setMessage({ kind: "ok", text: "✅ Profile photo updated. Look at your card!" });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  const c = business.content;

  // ---------- signed-out view ----------
  if (!auth) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-extrabold">Owner portal</h1>
        <p className="mt-2 text-muted">
          Manage <strong>{c.businessName}</strong>: update your site in plain words and set your profile photo.
        </p>
        <div className="card mt-6 space-y-4 p-6">
          {checking ? (
            <Loader2 className="mx-auto animate-spin" />
          ) : (
            <>
              {hasSupabase ? (
                linkSent ? (
                  <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                    📬 Check your email for a sign-in link. You can close this tab; the link brings you back here.
                  </p>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendLink();
                    }}
                  >
                    <label className="block text-sm font-semibold">
                      Owner email
                      <input type="email" required className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" size={16} />} Email me a sign-in link
                    </button>
                  </form>
                )
              ) : (
                <p className="text-sm text-muted">Email sign-in isn&apos;t configured on this server, so only demo access is available.</p>
              )}
              {canUseDemo && (
                <div className="border-t border-line pt-4 text-center">
                  <p className="text-sm text-muted">Judging or exploring?</p>
                  <button type="button" className="btn btn-ghost mt-2" onClick={() => setAuth({ kind: "demo" })}>
                    🎟️ Demo owner access
                  </button>
                </div>
              )}
            </>
          )}
          {message && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {message.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---------- signed-in view ----------
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{c.businessName}</h1>
          <p className="text-sm text-muted">{auth.kind === "demo" ? "Demo owner access" : `Signed in as ${auth.email}`}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sites/${business.slug}`} target="_blank" className="btn btn-ghost !py-2 text-sm">
            <ExternalLink size={16} /> View live site
          </Link>
          <button
            type="button"
            className="btn btn-ghost !py-2 text-sm"
            onClick={async () => {
              await supabase?.auth.signOut();
              setAuth(null);
              setLinkSent(false);
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      {message && (
        <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* card + photo */}
        <section className="card p-6">
          <h2 className="text-lg font-bold">Your digital business card</h2>
          <div className="mt-5 overflow-x-auto pb-2">
            <BusinessCard3D
              data={{
                name: c.businessName,
                tagline: c.cardTagline,
                area: c.serviceArea,
                emoji: c.theme.emoji,
                primary: c.theme.primary,
                accent: c.theme.accent,
                avatarUrl: business.avatarUrl,
                items: c.services.map((x) => `${x.emoji} ${x.name.en}`),
                hours: c.hours.en,
                slug: business.slug,
              }}
            />
          </div>
          <label className="btn btn-primary mt-4 w-full cursor-pointer">
            <Camera size={16} /> Upload profile photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCropSrc(URL.createObjectURL(f));
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }
                e.target.value = "";
              }}
            />
          </label>
        </section>

        {/* AI updater */}
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles size={18} className="text-brand" /> Quick AI site updater
          </h2>
          <p className="mt-1 text-sm text-muted">Say what changed, in any language. Your live website updates right away.</p>
          <textarea
            className="field mt-4"
            rows={3}
            maxLength={600}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Sold out of samosas this weekend, add Mango Lassi for $5"
          />
          <div className="mt-3">
            <AudioRecorder value={audio} onChange={setAudio} disabled={busy} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="rounded-full border border-line bg-white px-3 py-1 text-xs hover:border-brand" onClick={() => setInstruction(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary mt-4 w-full" disabled={busy || (!instruction.trim() && !audio)} onClick={applyUpdate}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Update my website
          </button>

          <div className="mt-6 rounded-xl bg-black/[.03] p-4 text-sm">
            <p className="font-semibold">Right now your site shows</p>
            <ul className="mt-2 space-y-1 text-muted">
              {c.announcement.en && <li>📣 {c.announcement.en}</li>}
              {c.services.map((s, i) => (
                <li key={i}>
                  {s.emoji} {s.name.en} · {s.price}
                </li>
              ))}
              <li>🕒 {c.hours.en}</li>
            </ul>
          </div>
        </section>
      </div>

      {/* private inbox */}
      <section className="card mt-8 p-6">
        <h2 className="text-lg font-bold">Private messages from customers</h2>
        {inquiries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No messages yet. Customers write through your site, so your contact details stay private.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {inquiries.map((q) => (
              <li key={q.id} className="py-3">
                <p className="font-semibold">
                  {q.name} <span className="font-normal text-muted">· {q.contact}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{q.message}</p>
                <p className="mt-1 text-xs text-muted">{new Date(q.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* crop modal */}
      {cropSrc && (
        <div role="dialog" aria-modal="true" aria-label="Crop profile photo" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-5">
            <h3 className="font-bold">Crop your photo</h3>
            <div className="relative mt-3 h-72 overflow-hidden rounded-xl bg-black">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setArea(px)}
              />
            </div>
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-3 w-full" aria-label="Zoom" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setCropSrc(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveAvatar} disabled={busy || !area}>
                {busy && <Loader2 className="animate-spin" size={16} />} Save photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
