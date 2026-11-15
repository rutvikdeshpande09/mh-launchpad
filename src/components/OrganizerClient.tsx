"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, LogOut, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/client";
import { fmtWait, requestMagicLink, useLinkCooldown } from "@/lib/magiclink";
import { hasSupabase, useOwnerSession } from "@/lib/useOwnerSession";

interface Site {
  slug: string;
  name: string;
  category: string;
  emoji: string;
  primary: string;
  accent: string;
  published: boolean;
  listed: boolean;
  isDemo: boolean;
  createdAt: string;
  ambassadorName: string;
  sortOrder: number | null;
  draftToken: string;
}

function Thumb({ s }: { s: Site }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-lg text-xl" style={{ background: `linear-gradient(135deg, ${s.primary}, ${s.accent})` }} aria-hidden>
      {s.emoji}
    </span>
  );
}

export default function OrganizerClient() {
  const { auth, ready, headers, supabase, signOut } = useOwnerSession();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const cooldown = useLinkCooldown();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [denied, setDenied] = useState("");

  const token = auth?.kind === "supabase" ? auth.token : "";
  const who = auth?.kind === "supabase" ? auth.email : "";

  const load = useCallback(async () => {
    const res = await fetch("/api/organizer", { headers: headers() });
    const data = (await res.json().catch(() => ({}))) as { sites?: Site[]; error?: string };
    if (res.status === 403 || res.status === 401) {
      setDenied(data.error ?? "Not allowed.");
      return;
    }
    if (!res.ok || !data.sites) {
      setMessage({ kind: "err", text: data.error ?? "Could not load the sites." });
      return;
    }
    setDenied("");
    setSites(data.sites);
    setOrder(data.sites.filter((s) => s.published && s.listed).map((s) => s.slug));
    setDirty(false);
  }, [headers]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch("/api/organizer", { headers: { authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (cancelled) return;
        const data = (await res.json().catch(() => ({}))) as { sites?: Site[]; error?: string };
        if (res.status === 403 || res.status === 401) setDenied(data.error ?? "Not allowed.");
        else if (res.ok && data.sites) {
          setDenied("");
          setSites(data.sites);
          setOrder(data.sites.filter((s) => s.published && s.listed).map((s) => s.slug));
          setDirty(false);
        } else setMessage({ kind: "err", text: data.error ?? "Could not load the sites." });
      })
      .catch(() => !cancelled && setMessage({ kind: "err", text: "Could not load the sites." }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function sendLink() {
    if (!supabase || cooldown.left > 0) return;
    setBusy(true);
    setMessage(null);
    const r = await requestMagicLink(supabase, email, `${window.location.origin}/organizer`);
    setBusy(false);
    if (r.cooldown) cooldown.start(r.cooldown);
    if (r.ok) setLinkSent(true);
    else setMessage({ kind: "err", text: r.error });
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: "ok", text: ok });
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setDirty(true);
  };

  if (!ready) return null;

  // ---------- signed out ----------
  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-3xl font-extrabold">Website organizer</h1>
        <p className="mt-2 text-muted">For the people who run MH Launchpad: reorder the homepage and manage every site, including unpublished ones.</p>
        <div className="card mt-6 space-y-4 p-6">
          {!hasSupabase ? (
            <p className="text-sm text-muted">Sign-in isn&apos;t configured on this server.</p>
          ) : linkSent ? (
            <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">📬 Check your email and click the link to continue.</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendLink();
              }}
            >
              <label className="block text-sm font-semibold">
                Organizer email
                <input type="email" required className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button type="submit" className="btn btn-primary w-full" disabled={busy || cooldown.left > 0}>
                {busy && <Loader2 className="animate-spin" size={16} />} {cooldown.left > 0 ? `Please wait ${fmtWait(cooldown.left)}` : "Email me a sign-in link"}
              </button>
              <p className="text-xs text-muted">Only emails added to the organizers list can use this page.</p>
            </form>
          )}
          {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message.text}</p>}
        </div>
      </div>
    );
  }

  // ---------- signed in but not an organizer ----------
  if (denied) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold">Not an organizer</h1>
        <p className="mt-2 text-muted">{denied}</p>
        <p className="mt-2 text-sm text-muted">Signed in as {who}. Ask an existing organizer to add this email to the organizers list.</p>
        <button type="button" className="btn btn-ghost mt-6" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    );
  }

  const byslug = new Map((sites ?? []).map((s) => [s.slug, s]));
  const published = order.map((slug) => byslug.get(slug)).filter((s): s is Site => Boolean(s));
  const unpublished = (sites ?? []).filter((s) => !s.published);
  const unlisted = (sites ?? []).filter((s) => s.published && !s.listed);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Website organizer</h1>
          <p className="text-sm text-muted">Signed in as {who}</p>
        </div>
        <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {message && (
        <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}
      {!sites && !message && <Loader2 className="mt-8 animate-spin" />}

      {sites && (
        <>
          <section className="card mt-8 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Homepage order ({published.length})</h2>
                <p className="text-sm text-muted">The first site is shown first on the homepage. Move sites up or down, then save.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!dirty || busy}
                onClick={() => act(() => postJson("/api/organizer", { action: "reorder", slugs: order }, headers()), "✅ Order saved. The homepage now shows it.")}
              >
                {busy && <Loader2 className="animate-spin" size={16} />} Save order
              </button>
            </div>
            {published.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No published sites yet.</p>
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {published.map((s, i) => (
                  <li key={s.slug} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-6 text-center font-mono text-sm font-bold">{i + 1}</span>
                    <Thumb s={s} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {s.name} {s.isDemo && <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">Demo</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{s.category}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" aria-label={`Move ${s.name} up`} className="btn btn-ghost !p-2" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                        <ArrowUp size={16} />
                      </button>
                      <button type="button" aria-label={`Move ${s.name} down`} className="btn btn-ghost !p-2" disabled={i === published.length - 1 || busy} onClick={() => move(i, 1)}>
                        <ArrowDown size={16} />
                      </button>
                      <Link href={`/sites/${s.slug}`} className="btn btn-ghost !px-3 !py-2 text-sm"><Eye size={16} /> View</Link>
                      <Link href={`/edit/${s.slug}`} className="btn btn-ghost !px-3 !py-2 text-sm"><Pencil size={16} /> Edit</Link>
                      <button type="button" className="btn btn-ghost !px-3 !py-2 text-sm" disabled={busy}
                        onClick={() => act(() => postJson("/api/organizer", { action: "listing", slug: s.slug, listed: false }, headers()), `✅ ${s.name} is now off the homepage (still public by link).`)}>
                        Unlist
                      </button>
                      <button type="button" className="btn btn-ghost !px-3 !py-2 text-sm" disabled={busy}
                        onClick={() => act(() => postJson("/api/organizer", { action: "publish", slug: s.slug, published: false }, headers()), `✅ ${s.name} is now hidden.`)}>
                        <EyeOff size={16} /> Hide
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {unlisted.length > 0 && (
            <section className="card mt-6 p-6">
              <h2 className="text-lg font-bold">Public by link only ({unlisted.length})</h2>
              <p className="text-sm text-muted">Published, but not shown on the homepage. Owners chose this, so only list one if they ask.</p>
              <ul className="mt-4 divide-y divide-line">
                {unlisted.map((s) => (
                  <li key={s.slug} className="flex flex-wrap items-center gap-3 py-3">
                    <Thumb s={s} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted">{s.category}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/sites/${s.slug}`} className="btn btn-ghost !px-3 !py-2 text-sm"><Eye size={16} /> View</Link>
                      <Link href={`/edit/${s.slug}`} className="btn btn-ghost !px-3 !py-2 text-sm"><Pencil size={16} /> Edit</Link>
                      <button type="button" className="btn btn-ghost !px-3 !py-2 text-sm" disabled={busy}
                        onClick={() => act(() => postJson("/api/organizer", { action: "listing", slug: s.slug, listed: true }, headers()), `✅ ${s.name} is now on the homepage.`)}>
                        List on homepage
                      </button>
                      <button type="button" className="btn btn-ghost !px-3 !py-2 text-sm" disabled={busy}
                        onClick={() => act(() => postJson("/api/organizer", { action: "publish", slug: s.slug, published: false }, headers()), `✅ ${s.name} is now hidden.`)}>
                        <EyeOff size={16} /> Hide
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card mt-6 p-6">
            <h2 className="text-lg font-bold">Not published ({unpublished.length})</h2>
            <p className="text-sm text-muted">Drafts waiting for owner approval, and sites that were hidden. Only organizers can see this list.</p>
            {unpublished.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nothing here. Every site is published.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {unpublished.map((s) => (
                  <li key={s.slug} className="flex flex-wrap items-center gap-3 py-3">
                    <Thumb s={s} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {s.name} {s.isDemo && <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">Demo</span>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {s.category} · by {s.ambassadorName || "unknown"} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/sites/${s.slug}?preview=${s.draftToken}`} className="btn btn-ghost !px-3 !py-2 text-sm"><Eye size={16} /> Preview</Link>
                      <Link href={`/edit/${s.slug}?draft=${s.draftToken}`} className="btn btn-ghost !px-3 !py-2 text-sm"><Pencil size={16} /> Edit</Link>
                      <button type="button" className="btn btn-primary !px-3 !py-2 text-sm" disabled={busy}
                        onClick={() => act(() => postJson("/api/organizer", { action: "publish", slug: s.slug, published: true }, headers()), `✅ ${s.name} is now public.`)}>
                        Publish
                      </button>
                      {confirmDelete === s.slug ? (
                        <>
                          <button type="button" className="btn !px-3 !py-2 text-sm bg-red-600 text-white" disabled={busy}
                            onClick={() => { setConfirmDelete(""); act(() => postJson("/api/organizer", { action: "delete", slug: s.slug }, headers()), `🗑️ ${s.name} was deleted.`); }}>
                            Yes, delete forever
                          </button>
                          <button type="button" className="btn btn-ghost !px-3 !py-2 text-sm" onClick={() => setConfirmDelete("")}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" aria-label={`Delete ${s.name}`} className="btn btn-ghost !p-2" disabled={busy} onClick={() => setConfirmDelete(s.slug)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
