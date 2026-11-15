"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Camera, ExternalLink, Loader2, LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { Business, Inquiry } from "@/lib/schemas";
import { postJson, type AudioClip } from "@/lib/client";
import { fmtWait, requestMagicLink, useLinkCooldown } from "@/lib/magiclink";
import { PRESETS, ensureReadable } from "@/lib/color";
import AudioRecorder from "./AudioRecorder";
import BusinessCard3D, { buildCardData } from "./BusinessCard3D";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(SUPA_URL && SUPA_ANON);

type Auth = { kind: "demo" } | { kind: "supabase"; token: string; email: string };

const EXAMPLES = [
  "Sold out of chicken tamales this weekend, add Atole for $5",
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

/** Shrink a chosen image so it uploads fast and stays under the server's 700 KB limit. PNG logos keep transparency. */
async function fileToDataUrl(file: File, maxSide: number): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("We couldn't read that image. Please try a JPG or PNG."));
      i.src = src;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (file.type === "image/png") {
      const png = canvas.toDataURL("image/png");
      if (png.length < 900_000) return png;
    }
    for (const q of [0.88, 0.75, 0.6, 0.45]) {
      const jpg = canvas.toDataURL("image/jpeg", q);
      if (jpg.length < 900_000) return jpg;
    }
    throw new Error("That image is too large. Please choose a smaller one.");
  } finally {
    URL.revokeObjectURL(src);
  }
}

const CARD_EXAMPLES = ["Make it darker and more elegant", "Keep my colours but make it friendlier", "Bolder, with a playful feel"];
const COLOR_EXAMPLES = ["Warm and cozy, like autumn", "Fresh and green, like a garden", "Elegant purple and gold"];

export default function ManageClient({ initial }: { initial: Business }) {
  const [business, setBusiness] = useState(initial);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [checking, setChecking] = useState(hasSupabase);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const cooldown = useLinkCooldown();
  const [instruction, setInstruction] = useState("");
  const [audio, setAudio] = useState<AudioClip | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [draftToken, setDraftToken] = useState("");
  const [colors, setColors] = useState({ primary: initial.content.theme.primary, accent: initial.content.theme.accent });

  // logo, business card and AI colour helper
  const [ackCard, setAckCard] = useState(false);
  const [cardPref, setCardPref] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [colorRequest, setColorRequest] = useState("");
  const [colorNote, setColorNote] = useState("");

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
          const data = (await res.json()) as { inquiries: Inquiry[]; draftToken?: string };
          setInquiries(data.inquiries);
          setDraftToken(data.draftToken ?? "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth, business.slug, headers]);

  async function sendLink() {
    if (!supabase || cooldown.left > 0) return;
    setBusy(true);
    setMessage(null);
    const r = await requestMagicLink(supabase, email, `${window.location.origin}/manage/${business.slug}`);
    setBusy(false);
    if (r.cooldown) cooldown.start(r.cooldown);
    if (r.ok) setLinkSent(true);
    else setMessage({ kind: "err", text: r.error });
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
      setColors({ primary: res.content.theme.primary, accent: res.content.theme.accent });
      setInstruction("");
      setAudio(null);
      setMessage({ kind: "ok", text: `✅ ${res.changeSummary}` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Update failed." });
    } finally {
      setBusy(false);
    }
  }

  async function setListing(listed: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/publish", { slug: business.slug, published: business.published, listed }, headers());
      setBusiness((b) => ({ ...b, listed }));
      setMessage({
        kind: "ok",
        text: listed ? "✅ Your site is now shown on the MH Launchpad homepage." : "✅ Your site is no longer listed on the homepage. People with your link can still open it.",
      });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Could not change the listing." });
    } finally {
      setBusy(false);
    }
  }

  async function setVisibility(published: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/publish", { slug: business.slug, published }, headers());
      setBusiness((b) => ({ ...b, published }));
      setMessage({
        kind: "ok",
        text: published ? "✅ Your site is now public." : "✅ Your site is hidden. Visitors can no longer see it. You can publish it again anytime.",
      });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Could not change visibility." });
    } finally {
      setBusy(false);
    }
  }

  async function saveColors() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<{ theme: Business["content"]["theme"] }>(
        "/api/manage",
        { slug: business.slug, action: "theme", primary: colors.primary, accent: colors.accent },
        headers(),
      );
      setBusiness((b) => ({ ...b, content: { ...b.content, theme: res.theme } }));
      setColors({ primary: res.theme.primary, accent: res.theme.accent });
      setMessage({ kind: "ok", text: "✅ Colours saved. Your site and business card now use them." });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Could not save the colours." });
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

  async function brandCall(body: Record<string, unknown>, okText?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<{ content: Business["content"]; note?: string }>("/api/manage", { slug: business.slug, ...body }, headers());
      setBusiness((b) => ({ ...b, content: res.content }));
      setMessage({ kind: "ok", text: res.note ? `✅ ${res.note}` : okText ?? "✅ Saved." });
      return true;
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Something went wrong. Please try again." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pickImage(file: File | undefined, action: "logo" | "card-upload") {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, action === "logo" ? 600 : 1100);
      await brandCall({ action, dataUrl }, action === "logo" ? "✅ Logo saved. It now shows on your site and card." : "✅ Card uploaded. Your own card is now shown as the front.");
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  async function suggestColors() {
    setBusy(true);
    setMessage(null);
    setColorNote("");
    try {
      const r = await postJson<{ name: string; primary: string; accent: string; explanation: string }>(
        "/api/manage",
        { slug: business.slug, action: "suggest-colors", request: colorRequest.trim() },
        headers(),
      );
      setColors({ primary: r.primary, accent: r.accent });
      setColorNote(`${r.name}: ${r.explanation} Preview it below, then press “Save colours”.`);
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "The AI couldn't suggest colours." });
    } finally {
      setBusy(false);
    }
  }

  const c = business.content;
  const brand = c.brand ?? {};
  const cardMode = brand.cardMode ?? "generated";
  const locationText = location ?? brand.cardLocation ?? c.serviceArea;
  // What you see is what gets saved: colours too light for white text are darkened automatically.
  const safe = { primary: ensureReadable(colors.primary), accent: ensureReadable(colors.accent, "#0f766e") };
  const colorsChanged = safe.primary !== c.theme.primary || safe.accent !== c.theme.accent;

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
                    <button type="submit" className="btn btn-primary w-full" disabled={busy || cooldown.left > 0}>
                      {busy && <Loader2 className="animate-spin" size={16} />} {cooldown.left > 0 ? `Please wait ${fmtWait(cooldown.left)}` : "Email me a sign-in link"}
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
          <Link
            href={business.published ? `/sites/${business.slug}` : `/sites/${business.slug}?preview=${draftToken}`}
            target="_blank"
            className="btn btn-ghost !py-2 text-sm"
          >
            <ExternalLink size={16} /> {business.published ? "View live site" : "Preview draft"}
          </Link>
          <Link href={`/edit/${business.slug}`} className="btn btn-primary !py-2 text-sm">
            Edit content
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
            <BusinessCard3D data={buildCardData(c, { slug: business.slug, avatarUrl: business.avatarUrl, primary: safe.primary, accent: safe.accent })} />
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
            placeholder="e.g. Sold out of chicken tamales this weekend, add Atole for $5"
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

      {/* logo and business card */}
      <section className="card mt-8 p-6">
        <h2 className="text-lg font-bold">Your logo and business card</h2>
        <p className="mt-1 text-sm text-muted">
          Add your own logo, and choose how your digital card looks: built from your site, made to look like your own card, or your own card exactly as it is.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold">Logo</h3>
            <div className="mt-2 flex items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="Your logo" className="size-full object-contain p-1" />
                ) : (
                  <span className="text-xs text-muted">No logo yet</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="btn btn-primary cursor-pointer !py-2 text-sm">
                  {brand.logoUrl ? "Replace logo" : "Upload logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { pickImage(e.target.files?.[0], "logo"); e.target.value = ""; }} />
                </label>
                {brand.logoUrl && (
                  <button type="button" className="btn btn-ghost !py-2 text-sm" disabled={busy} onClick={() => brandCall({ action: "remove-logo" }, "✅ Logo removed.")}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">Shown at the top of your site and on your card. PNG, JPG or WebP.</p>
          </div>

          <div>
            <h3 className="font-semibold">Location shown on the card</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className="field min-w-0 flex-1"
                maxLength={60}
                value={locationText}
                onChange={(e) => setLocation(e.target.value)}
                aria-label="Location shown on the card"
                placeholder="e.g. Mountain House, CA"
              />
              <button type="button" className="btn btn-primary !py-2 text-sm" disabled={busy} onClick={() => brandCall({ action: "card-settings", location: locationText }, "✅ Card location updated.")}>
                Save
              </button>
              <button type="button" className="btn btn-ghost !py-2 text-sm" disabled={busy} onClick={() => { setLocation(""); brandCall({ action: "card-settings", location: "" }, "✅ Location hidden on your card."); }}>
                Hide
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">Use a city or area only. Street addresses, phone numbers and emails are not allowed.</p>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-semibold">Use my own business card</h3>
          <p className="mt-1 text-sm text-muted">Upload a photo or scan of your current card. Then either keep it exactly as it is, or ask the AI to build a digital card in a similar style.</p>

          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ackCard} onChange={(e) => setAckCard(e.target.checked)} />
            <span>
              I understand my card photo is shown <strong>publicly</strong> on my page if I keep it as is, and it is read by Google Gemini (AI) if I ask for a similar card. It should not show a home address or a number I want private.
            </span>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className={`btn btn-primary cursor-pointer !py-2 text-sm ${!ackCard || busy ? "pointer-events-none opacity-50" : ""}`}>
              {brand.cardImageUrl ? "Replace my card photo" : "Upload my card photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!ackCard || busy} onChange={(e) => { pickImage(e.target.files?.[0], "card-upload"); e.target.value = ""; }} />
            </label>
            {brand.cardImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.cardImageUrl} alt="Your uploaded card" className="h-16 rounded-lg border border-line bg-white object-contain" />
            )}
          </div>

          {brand.cardImageUrl && (
            <>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Card version">
                {([["generated", "Built from my site"], ["similar", "Similar to my card (AI)"], ["own", "My own card"]] as const).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={cardMode === m}
                    disabled={busy || (m === "similar" && !brand.cardPrimary)}
                    title={m === "similar" && !brand.cardPrimary ? "Ask the AI below first" : undefined}
                    onClick={() => brandCall({ action: "card-settings", mode: m }, "✅ Card updated.")}
                    className={`rounded-full border-2 bg-white px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${cardMode === m ? "border-foreground" : "border-line"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-[#fffaf3] p-4">
                <label className="block text-sm font-semibold" htmlFor="card-pref">
                  <Sparkles size={14} className="mr-1 inline" /> Ask the AI to build a card like yours
                </label>
                <textarea
                  id="card-pref"
                  className="field mt-2 min-h-20"
                  maxLength={400}
                  value={cardPref}
                  onChange={(e) => setCardPref(e.target.value)}
                  placeholder="Tell the AI what you prefer (any language), e.g. “Keep the same colours but make it simpler”"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {CARD_EXAMPLES.map((ex) => (
                    <button key={ex} type="button" className="rounded-full border border-line bg-white px-3 py-1 text-xs" onClick={() => setCardPref(ex)}>
                      {ex}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-primary mt-3 !py-2 text-sm"
                  disabled={busy || !ackCard}
                  onClick={() => brandCall({ action: "card-similar", preference: cardPref.trim() || undefined, location: locationText })}
                >
                  {busy && <Loader2 className="animate-spin" size={16} />} Build a similar card
                </button>
                {!ackCard && <p className="mt-2 text-xs text-muted">Tick the box above first.</p>}
              </div>
            </>
          )}

          {(brand.cardMode || brand.cardStyle) && (
            <button type="button" className="btn btn-ghost mt-4 !py-2 text-sm" disabled={busy} onClick={() => brandCall({ action: "card-settings", reset: true }, "✅ Card reset to the one built from your site.")}>
              Reset card to the default
            </button>
          )}
        </div>
      </section>

      {/* site colours */}
      <section className="card mt-8 p-6">
        <h2 className="text-lg font-bold">Site colours</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a colour scheme for your website and business card. Colours that are too light to read with white text are darkened automatically.
        </p>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Preset colour schemes">
          {PRESETS.map((p) => {
            const on = ensureReadable(p.primary) === safe.primary && ensureReadable(p.accent, "#0f766e") === safe.accent;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setColors({ primary: p.primary, accent: p.accent })}
                aria-pressed={on}
                className={`flex items-center gap-2 rounded-full border-2 bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold ${on ? "border-foreground" : "border-line"}`}
              >
                <span className="size-6 rounded-full" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }} />
                {p.name}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl bg-[#fffaf3] p-4">
          <label className="block text-sm font-semibold" htmlFor="color-ai">
            <Sparkles size={14} className="mr-1 inline" /> Not quite right? Tell the AI what you want
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="color-ai"
              className="field min-w-0 flex-1"
              maxLength={300}
              value={colorRequest}
              onChange={(e) => setColorRequest(e.target.value)}
              placeholder="e.g. “Soft pink and gold, like a wedding”"
            />
            <button type="button" className="btn btn-primary !py-2 text-sm" disabled={busy || colorRequest.trim().length < 2} onClick={suggestColors}>
              {busy && <Loader2 className="animate-spin" size={16} />} Suggest colours
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="rounded-full border border-line bg-white px-3 py-1 text-xs" onClick={() => setColorRequest(ex)}>
                {ex}
              </button>
            ))}
          </div>
          {colorNote && <p role="status" className="mt-2 text-sm text-green-800">{colorNote}</p>}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="color" value={colors.primary} onChange={(e) => setColors((cl) => ({ ...cl, primary: e.target.value }))} className="size-11 cursor-pointer rounded-lg border border-line bg-white p-1" />
            Main colour
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="color" value={colors.accent} onChange={(e) => setColors((cl) => ({ ...cl, accent: e.target.value }))} className="size-11 cursor-pointer rounded-lg border border-line bg-white p-1" />
            Accent colour
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl" style={{ background: `linear-gradient(135deg, ${safe.primary}, ${safe.accent})` }} aria-label="Preview of your site header">
          <div className="px-5 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Preview</p>
            <p className="mt-1 text-2xl font-black">{c.businessName}</p>
            <p className="text-sm opacity-90">{c.tagline.en}</p>
            <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold" style={{ color: safe.primary }}>
              Send us a message
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={busy || !colorsChanged} onClick={saveColors}>
            {busy && <Loader2 className="animate-spin" size={16} />} Save colours
          </button>
          {colorsChanged && (
            <button type="button" className="btn btn-ghost" onClick={() => setColors({ primary: c.theme.primary, accent: c.theme.accent })}>
              Undo
            </button>
          )}
          {(safe.primary !== colors.primary.toLowerCase() || safe.accent !== colors.accent.toLowerCase()) && (
            <p className="text-sm text-amber-800">One colour was darkened so white text stays readable.</p>
          )}
        </div>
      </section>

      {/* visibility */}
      <section className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-lg font-bold">Site visibility</h2>
          <p className="mt-1 text-sm text-muted">
            Your site is currently{" "}
            <strong className={business.published ? "text-green-700" : "text-amber-700"}>
              {business.published ? "public" : "hidden (not visible to visitors)"}
            </strong>
            . You are always in control: hide it any time and publish it again when you are ready.
          </p>
        </div>
        <button
          type="button"
          className={`btn ${business.published ? "btn-ghost" : "btn-primary"}`}
          disabled={busy}
          onClick={() => setVisibility(!business.published)}
        >
          {business.published ? "Hide my site" : "Publish my site"}
        </button>
        {business.published && (
          <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-black/[.04] p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={!business.listed} disabled={busy} onChange={(e) => setListing(!e.target.checked)} />
            <span>
              <strong>Don&apos;t show my site on the MH Launchpad homepage.</strong> It stays public for anyone you give the link to, but it isn&apos;t
              listed or promoted to the community.
            </span>
          </label>
        )}
      </section>

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
