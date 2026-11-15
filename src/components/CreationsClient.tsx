"use client";

import { Eye, Loader2, Pencil, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAmbassador } from "@/lib/client";
import { useOwnerSession } from "@/lib/useOwnerSession";

interface Creation {
  slug: string;
  name: string;
  category: string;
  emoji: string;
  primary: string;
  accent: string;
  published: boolean;
  isDemo: boolean;
  createdAt: string;
  draftToken: string;
}

function Card({ c }: { c: Creation }) {
  const view = c.published ? `/sites/${c.slug}` : `/sites/${c.slug}?preview=${c.draftToken}`;
  return (
    <li className="card flex flex-col overflow-hidden">
      <div className="grid h-24 place-items-center text-5xl" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.accent})` }} aria-hidden>
        {c.emoji}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{c.name}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.published ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>
            {c.published ? "Public" : "Draft or hidden"}
          </span>
          {c.isDemo && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">Demo</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {c.category} · {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={view} className="btn btn-primary !py-1.5 text-sm">
            <Eye size={16} /> {c.published ? "View" : "Preview"}
          </Link>
          <Link href={`/edit/${c.slug}?draft=${c.draftToken}`} className="btn btn-ghost !py-1.5 text-sm">
            <Pencil size={16} /> Edit
          </Link>
          <Link href={`/manage/${c.slug}`} className="btn btn-ghost !py-1.5 text-sm">
            <Settings size={16} /> Manage
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function CreationsClient() {
  const { session, ready: ambReady } = useAmbassador();
  const { auth, ready: ownerReady, headers: ownerHeaders, startDemo } = useOwnerSession();
  const [data, setData] = useState<{ asAmbassador: Creation[]; asOwner: Creation[] } | null>(null);
  const [error, setError] = useState("");

  const ambToken = session?.token;
  const ownerKey = auth ? (auth.kind === "demo" ? "demo" : auth.token) : "";

  useEffect(() => {
    if (!ambReady || !ownerReady) return;
    if (!ambToken && !ownerKey) return;
    let cancelled = false;
    fetch("/api/creations", { headers: { ...(ambToken ? { "x-ambassador-token": ambToken } : {}), ...ownerHeaders() } })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Could not load your creations.");
        else setData((await r.json()) as { asAmbassador: Creation[]; asOwner: Creation[] });
      })
      .catch(() => !cancelled && setError("Could not load your creations."));
    return () => {
      cancelled = true;
    };
  }, [ambReady, ownerReady, ambToken, ownerKey, ownerHeaders]);

  if (!ambReady || !ownerReady) return null;

  if (!ambToken && !ownerKey) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold">My creations</h1>
        <p className="mt-2 text-muted">Sign in to see the websites you&apos;ve made or that belong to your business.</p>
        <div className="mt-6 grid gap-3">
          <Link href="/ambassador" className="btn btn-primary">I&apos;m a student ambassador</Link>
          <Link href="/owner" className="btn btn-ghost">I own a business</Link>
          <button type="button" className="btn btn-ghost" onClick={startDemo}>🎟️ Demo owner access (judges)</button>
        </div>
      </div>
    );
  }

  const none = data && data.asAmbassador.length === 0 && data.asOwner.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">My creations</h1>
      <p className="mt-1 text-muted">Every site you&apos;ve interviewed for or own. Preview a draft, edit the words, or manage colours and visibility.</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && !error && <Loader2 className="mt-8 animate-spin" />}

      {none && (
        <div className="card mt-8 p-8 text-center">
          <p className="text-4xl">🌱</p>
          <p className="mt-2 font-bold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">Sites you create will show up here.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/interview" className="btn btn-primary">Start an interview</Link>
            <Link href="/owner" className="btn btn-ghost">Request an ambassador</Link>
          </div>
        </div>
      )}

      {data && data.asAmbassador.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Sites you interviewed for</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.asAmbassador.map((c) => <Card key={c.slug} c={c} />)}</ul>
        </section>
      )}
      {data && data.asOwner.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Your businesses</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.asOwner.map((c) => <Card key={c.slug} c={c} />)}</ul>
        </section>
      )}
    </div>
  );
}
