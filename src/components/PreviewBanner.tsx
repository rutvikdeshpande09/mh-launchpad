"use client";

import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/client";

/** Shown on top of an unpublished site when opened with the private draft link. */
export default function PreviewBanner({ slug, token }: { slug: string; token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/publish", { slug, published: true }, { "x-draft-token": token });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="sticky top-[57px] z-30 border-b-2 border-amber-400 bg-amber-100 px-4 py-3 text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        {done ? (
          <>
            <p className="font-semibold">✅ Published! The site is now public.</p>
            <Link href={`/sites/${slug}`} className="btn btn-primary !py-1.5 text-sm">
              Open the public page
            </Link>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold sm:text-base">
              <Eye size={18} /> Draft preview. Only people with this private link can see it. Check the details with the owner, then publish.
            </p>
            <div className="flex items-center gap-3">
              {error && <span className="text-sm text-red-700">{error}</span>}
              <button type="button" className="btn btn-primary !py-1.5 text-sm" onClick={publish} disabled={busy}>
                {busy && <Loader2 className="animate-spin" size={16} />} Approve &amp; publish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
