"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabase = Boolean(SUPA_URL && SUPA_ANON);

export type OwnerAuth = { kind: "demo" } | { kind: "supabase"; token: string; email: string };

// Judge "demo owner access" lives in sessionStorage so it follows you between pages in this tab.
const DEMO_KEY = "mh_demo_owner";
const DEMO_EVENT = "mh-demo-owner-change";
const readDemo = () => {
  try {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
};
const subscribeDemo = (cb: () => void) => {
  window.addEventListener(DEMO_EVENT, cb);
  return () => window.removeEventListener(DEMO_EVENT, cb);
};

/** Shared owner sign-in state: a Supabase magic-link session, or judge demo access. */
export function useOwnerSession() {
  const demo = useSyncExternalStore(subscribeDemo, readDemo, () => false);
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const [checked, setChecked] = useState(!hasSupabase);

  const supabase: SupabaseClient | null = useMemo(() => (hasSupabase ? createClient(SUPA_URL!, SUPA_ANON!) : null), []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s?.user.email ? { token: s.access_token, email: s.user.email } : null);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s?.user.email ? { token: s.access_token, email: s.user.email } : null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const auth: OwnerAuth | null = session ? { kind: "supabase", ...session } : demo ? { kind: "demo" } : null;

  const headers = useCallback((): Record<string, string> => {
    if (session) return { authorization: `Bearer ${session.token}` };
    if (demo) return { "x-demo-owner": "1" };
    return {};
  }, [session, demo]);

  const startDemo = () => {
    try {
      sessionStorage.setItem(DEMO_KEY, "1");
    } catch {
      /* private mode: demo lasts until reload */
    }
    window.dispatchEvent(new Event(DEMO_EVENT));
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    try {
      sessionStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DEMO_EVENT));
  };

  return { auth, ready: checked, headers, startDemo, supabase, signOut };
}
