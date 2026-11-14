"use client";

import { Check, Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { clearAmbassador, postJson, type AmbassadorSession } from "@/lib/client";
import type { AmbassadorProfile, InterviewRequest } from "@/lib/schemas";

type SafeRequest = Omit<InterviewRequest, "ownerEmail">;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-teal-100 text-teal-900",
  declined: "bg-black/5 text-muted",
  completed: "bg-green-100 text-green-900",
};

export default function AmbassadorDashboard({ session }: { session: AmbassadorSession }) {
  const headers = useCallback(() => ({ "x-ambassador-token": session.token }), [session.token]);
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [requests, setRequests] = useState<SafeRequest[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [accepting, setAccepting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ambassador", { headers: headers() });
    if (res.status === 401) {
      clearAmbassador();
      return;
    }
    const data = (await res.json()) as { profile: AmbassadorProfile; requests: SafeRequest[] };
    setProfile(data.profile);
    setRequests(data.requests);
    setLanguages(data.profile.languages.length ? data.profile.languages : ["en"]);
    setBio(data.profile.bio);
    setAccepting(data.profile.languages.length ? data.profile.accepting : true);
    setLoaded(true);
  }, [headers]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ambassador", { headers: headers() })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return clearAmbassador();
        const data = (await res.json()) as { profile: AmbassadorProfile; requests: SafeRequest[] };
        setProfile(data.profile);
        setRequests(data.requests);
        setLanguages(data.profile.languages.length ? data.profile.languages : ["en"]);
        setBio(data.profile.bio);
        setAccepting(data.profile.languages.length ? data.profile.accepting : true);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [headers]);

  async function saveProfile() {
    setBusy(true);
    setNote(null);
    try {
      await postJson("/api/ambassador", { action: "profile", languages, bio, accepting }, headers());
      setNote({ kind: "ok", text: accepting ? "Saved. Businesses can now find and choose you." : "Saved. You're hidden from businesses for now." });
      await load();
    } catch (e) {
      setNote({ kind: "err", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  async function respond(requestId: string, decision: "accept" | "decline") {
    setBusy(true);
    setNote(null);
    try {
      await postJson("/api/ambassador", { action: "respond", requestId, decision }, headers());
      await load();
    } catch (e) {
      setNote({ kind: "err", text: e instanceof Error ? e.message : "Could not answer the request." });
    } finally {
      setBusy(false);
    }
  }

  const setupDone = Boolean(profile && profile.languages.length > 0);
  const waiting = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Hi {session.name}, you&apos;re a Tech Ambassador</h1>
          <p className="mt-1 text-sm text-muted">
            🏅 Tech Ambassador{session.demo ? " · judge demo access" : ""}. {waiting > 0 && <strong className="text-brand">{waiting} request{waiting > 1 ? "s" : ""} waiting for you.</strong>}
          </p>
        </div>
        <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => clearAmbassador()}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {note && (
        <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${note.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {note.text}
        </p>
      )}

      {/* ---------- requests ---------- */}
      <section className="card mt-8 p-6">
        <h2 className="text-lg font-bold">Interview requests</h2>
        {!loaded ? (
          <Loader2 className="mt-4 animate-spin" />
        ) : requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No requests yet. Businesses choose an ambassador on the <Link href="/owner" className="font-semibold text-brand underline">For businesses</Link> page.
            {!setupDone && " Finish your public profile below so they can find you."} You can also interview a business you contacted yourself.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{r.businessName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  {r.isDemo && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">Demo</span>}
                </div>
                <p className="mt-1 text-sm text-muted">
                  Speaks {getLanguage(r.ownerLanguage).label}
                  {r.contact && <> · Reach them at <strong className="text-foreground">{r.contact}</strong></>}
                </p>
                {r.note && <p className="mt-1 whitespace-pre-wrap text-sm">&ldquo;{r.note}&rdquo;</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "pending" && (
                    <>
                      <button type="button" className="btn btn-primary !py-1.5 text-sm" disabled={busy} onClick={() => respond(r.id, "accept")}>
                        <Check size={16} /> Accept
                      </button>
                      <button type="button" className="btn btn-ghost !py-1.5 text-sm" disabled={busy} onClick={() => respond(r.id, "decline")}>
                        Decline
                      </button>
                    </>
                  )}
                  {r.status === "accepted" && (
                    <Link href={`/interview?request=${r.id}`} className="btn btn-primary !py-1.5 text-sm">
                      Start the interview
                    </Link>
                  )}
                  {r.status === "completed" && <p className="text-sm text-green-800">Interview complete. The owner can review and publish the draft.</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- public profile ---------- */}
      <section className="card mt-6 p-6">
        <h2 className="text-lg font-bold">Your public profile</h2>
        <p className="mt-1 text-sm text-muted">
          Businesses see your first name and last initial, the languages you can interview in, and your short bio. Never your email.
        </p>
        {!setupDone && loaded && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Set this up so businesses can find and choose you.</p>
        )}
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Languages you can interview in</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const on = languages.includes(l.code);
              return (
                <label
                  key={l.code}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => setLanguages((prev) => (on ? prev.filter((c) => c !== l.code) : [...prev, l.code]))}
                  />
                  {l.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="mt-4 block text-sm font-semibold">
          Short bio (optional)
          <textarea className="field mt-1" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="e.g. Junior who loves helping small businesses get online." />
          <span className="text-xs font-normal text-muted">{bio.length}/160. Don&apos;t include your phone number or address.</span>
        </label>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />
          I&apos;m accepting interview requests
        </label>
        <button type="button" className="btn btn-primary mt-4" disabled={busy || languages.length === 0} onClick={saveProfile}>
          {busy && <Loader2 className="animate-spin" size={16} />} Save profile
        </button>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/interview" className="btn btn-ghost">Interview a business I contacted myself</Link>
      </div>
    </div>
  );
}
