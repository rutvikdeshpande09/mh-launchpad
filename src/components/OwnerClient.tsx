"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { postJson } from "@/lib/client";
import { fmtWait, requestMagicLink, useLinkCooldown } from "@/lib/magiclink";
import type { InterviewRequest, PublicAmbassador } from "@/lib/schemas";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(SUPA_URL && SUPA_ANON);

type Auth = { kind: "demo" } | { kind: "supabase"; token: string; email: string };
type SafeRequest = Omit<InterviewRequest, "ownerEmail">;

const STATUS_TEXT: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting for a reply", cls: "bg-amber-100 text-amber-900" },
  accepted: { label: "Accepted. They'll interview you", cls: "bg-teal-100 text-teal-900" },
  declined: { label: "Declined. Please choose another ambassador", cls: "bg-black/5 text-muted" },
  completed: { label: "Your site draft is ready", cls: "bg-green-100 text-green-900" },
};

export default function OwnerClient() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [checking, setChecking] = useState(hasSupabase);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const cooldown = useLinkCooldown();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerLanguage, setOwnerLanguage] = useState("en");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [ambassadors, setAmbassadors] = useState<PublicAmbassador[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [requests, setRequests] = useState<SafeRequest[]>([]);

  const supabase: SupabaseClient | null = useMemo(() => (hasSupabase ? createClient(SUPA_URL!, SUPA_ANON!) : null), []);

  const headers = useCallback((): Record<string, string> => {
    if (!auth) return {};
    return auth.kind === "demo" ? { "x-demo-owner": "1" } : { authorization: `Bearer ${auth.token}` };
  }, [auth]);

  // restore a magic-link session
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

  const refreshRequests = useCallback(async () => {
    const res = await fetch("/api/owner/requests", { headers: headers() });
    if (res.ok) setRequests(((await res.json()) as { requests: SafeRequest[] }).requests);
  }, [headers]);

  // load the ambassador directory + my requests once signed in
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const demo = auth.kind === "demo";
    fetch(`/api/ambassadors${demo ? "?demo=1" : ""}`)
      .then((r) => r.json())
      .then((d: { ambassadors: PublicAmbassador[] }) => !cancelled && setAmbassadors(d.ambassadors))
      .catch(() => !cancelled && setAmbassadors([]));
    fetch("/api/owner/requests", { headers: headers() })
      .then(async (r) => {
        if (!cancelled && r.ok) setRequests(((await r.json()) as { requests: SafeRequest[] }).requests);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth, headers]);

  async function sendLink() {
    if (!supabase || cooldown.left > 0) return;
    setBusy(true);
    setMessage(null);
    const r = await requestMagicLink(supabase, email, `${window.location.origin}/owner`);
    setBusy(false);
    if (r.cooldown) cooldown.start(r.cooldown);
    if (r.ok) setLinkSent(true);
    else setMessage({ kind: "err", text: r.error });
  }

  async function submitRequest() {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/owner/requests", { businessName, ownerLanguage, note, contact, ambassadorId: chosen }, headers());
      setMessage({ kind: "ok", text: "✅ Request sent! The ambassador will see it and reply here." });
      setBusinessName("");
      setNote("");
      setContact("");
      setChosen("");
      await refreshRequests();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Could not send the request." });
    } finally {
      setBusy(false);
    }
  }

  // ambassadors who speak my language first
  const sorted = useMemo(
    () => [...(ambassadors ?? [])].sort((a, b) => Number(b.languages.includes(ownerLanguage)) - Number(a.languages.includes(ownerLanguage))),
    [ambassadors, ownerLanguage],
  );

  // ---------- signed out ----------
  if (!auth) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-3xl font-extrabold">For business owners</h1>
        <p className="mt-2 text-muted">
          Get a free website and digital business card for your business or hobby. Tell us what to call it, and choose the student ambassador
          who will interview you. <strong>Nothing goes public until you approve it.</strong> Keep it private as long as you like.
        </p>
        <div className="card mt-6 space-y-4 p-6">
          {checking ? (
            <Loader2 className="mx-auto animate-spin" />
          ) : (
            <>
              {hasSupabase ? (
                linkSent ? (
                  <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                    📬 Check your email for a link. Click it to continue. This works for both signing up and signing in.
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
                      Your email
                      <input type="email" required className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <button type="submit" className="btn btn-primary w-full" disabled={busy || cooldown.left > 0}>
                      {busy && <Loader2 className="animate-spin" size={16} />} {cooldown.left > 0 ? `Please wait ${fmtWait(cooldown.left)}` : "Email me a sign-in link"}
                    </button>
                    <p className="text-xs text-muted">No password needed. Your email is never shown publicly.</p>
                  </form>
                )
              ) : (
                <p className="text-sm text-muted">Email sign-in isn&apos;t set up on this server, so only demo access is available.</p>
              )}
              <div className="border-t border-line pt-4 text-center">
                <p className="text-sm text-muted">Judging or just exploring?</p>
                <button type="button" className="btn btn-ghost mt-2" onClick={() => setAuth({ kind: "demo" })}>
                  🎟️ Demo owner access
                </button>
              </div>
            </>
          )}
          {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message.text}</p>}
        </div>
      </div>
    );
  }

  // ---------- signed in ----------
  const canSubmit = businessName.trim().length >= 2 && chosen !== "";
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Get your business online</h1>
          <p className="text-sm text-muted">{auth.kind === "demo" ? "Demo owner access" : `Signed in as ${auth.email}`}</p>
        </div>
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

      {message && (
        <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}

      <p className="mt-6 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
        🔒 Your page stays a <strong>private draft</strong> until you approve it. You can keep it private as long as you like and hide it any time.
        Your email is only used to sign in and is never shown publicly.
      </p>

      <section className="card mt-6 space-y-4 p-6">
        <h2 className="text-lg font-bold">1. Tell us about your business or hobby</h2>
        <label className="block text-sm font-semibold">
          Business or shop name (a hobby is fine)
          <input className="field mt-1" value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={80} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Language you&apos;d like to be interviewed in
            <select className="field mt-1" value={ownerLanguage} onChange={(e) => setOwnerLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.native})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            How should your ambassador reach you? (optional)
            <input className="field mt-1" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="Phone or email" />
            <span className="mt-1 block text-xs font-normal text-muted">Shared only with the ambassador you choose.</span>
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Anything the ambassador should know? (optional)
          <textarea className="field mt-1" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Best times, what you sell, questions…" />
        </label>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-lg font-bold">2. Choose your ambassador</h2>
        <p className="mt-1 text-sm text-muted">Students who speak {getLanguage(ownerLanguage).label} are shown first. Only their first name and last initial are public.</p>
        {ambassadors === null ? (
          <Loader2 className="mt-4 animate-spin" />
        ) : sorted.length === 0 ? (
          <p className="mt-4 rounded-lg bg-black/[.03] p-4 text-sm text-muted">
            No ambassadors are available yet. Please check back soon.
            {auth.kind === "demo" && " For the demo: open the Ambassador page in another tab, choose Judge demo access, and save a profile. Then come back and refresh."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {sorted.map((a) => {
              const speaks = a.languages.includes(ownerLanguage);
              const on = chosen === a.id;
              return (
                <li key={a.id}>
                  <label className={`block cursor-pointer rounded-xl border-2 p-4 ${on ? "border-ink bg-cta/25" : "border-line bg-white"}`}>
                    <input type="radio" name="ambassador" className="sr-only" checked={on} onChange={() => setChosen(a.id)} />
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold">{a.name}</span>
                      {speaks && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-900">Speaks {getLanguage(ownerLanguage).label}</span>}
                    </span>
                    <span className="mt-1 block text-xs text-muted">{a.languages.map((c) => getLanguage(c).label).join(", ")}</span>
                    {a.bio && <span className="mt-2 block text-sm">{a.bio}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="btn btn-primary mt-5 w-full" disabled={!canSubmit || busy} onClick={submitRequest}>
          {busy && <Loader2 className="animate-spin" size={16} />} Send interview request
        </button>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-lg font-bold">Your requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet. Requests you send will appear here with their status.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {requests.map((r) => {
              const st = STATUS_TEXT[r.status];
              return (
                <li key={r.id} className="py-3">
                  <p className="font-semibold">
                    {r.businessName} <span className="font-normal text-muted">with {r.ambassadorName}</span>
                  </p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                  {r.status === "completed" && r.businessSlug && (
                    <p className="mt-2 text-sm">
                      <Link href={`/manage/${r.businessSlug}`} className="font-semibold text-brand underline">
                        Open your owner portal
                      </Link>{" "}
                      to preview your draft and publish it when you&apos;re happy with it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
