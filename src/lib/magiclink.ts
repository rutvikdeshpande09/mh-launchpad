"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Supabase's built-in email sender allows only a few sign-in emails per hour. We add a short
// cooldown so people don't burn through that limit by double-clicking, and explain it kindly.
const KEY = "mh_link_until";
const COOLDOWN_S = 60;
const LIMIT_COOLDOWN_S = 15 * 60;

function readUntil(): number {
  try {
    return Number(sessionStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function writeUntil(ms: number) {
  try {
    sessionStorage.setItem(KEY, String(ms));
  } catch {
    /* private mode: the in-page timer still works */
  }
}

/** Seconds left before another sign-in email may be requested. */
export function useLinkCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => {
      setUntil(readUntil());
      setNow(Date.now());
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return {
    left,
    start: (seconds: number) => {
      const u = Date.now() + seconds * 1000;
      writeUntil(u);
      setUntil(u);
      setNow(Date.now());
    },
  };
}

export const fmtWait = (s: number) => (s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`);

/** Ask Supabase to email a sign-in link. Never throws; returns a friendly message on failure. */
export async function requestMagicLink(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<{ ok: true; cooldown: number } | { ok: false; error: string; cooldown: number }> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return { ok: false, error: "Please enter a valid email address.", cooldown: 0 };
  const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { emailRedirectTo: redirectTo } });
  if (!error) return { ok: true, cooldown: COOLDOWN_S };
  const limited = (error as { status?: number }).status === 429 || /rate limit|too many|seconds/i.test(error.message);
  if (limited) {
    return {
      ok: false,
      cooldown: LIMIT_COOLDOWN_S,
      error:
        "We've sent a lot of sign-in emails recently, so the email service needs a short break. Please check your inbox and spam folder for a link we already sent, or try again in about 15 minutes. Judges can use “Demo owner access” instead.",
    };
  }
  return { ok: false, error: error.message, cooldown: 0 };
}
