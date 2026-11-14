"use client";

import { useMemo, useSyncExternalStore } from "react";

// ---------- ambassador session (stored only in this browser) ----------
export interface AmbassadorSession {
  token: string;
  name: string;
  demo: boolean;
}
const KEY = "mh_ambassador";

const EVENT = "mh-ambassador-change";
let memorySession: string | null = null; // fallback when localStorage is unavailable

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? memorySession ?? "";
  } catch {
    return memorySession ?? "";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Reactive ambassador session. `ready` is false during server render / hydration. */
export function useAmbassador(): { session: AmbassadorSession | null; ready: boolean } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "__ssr__");
  return useMemo(() => {
    if (raw === "__ssr__") return { session: null, ready: false };
    try {
      return { session: raw ? (JSON.parse(raw) as AmbassadorSession) : null, ready: true };
    } catch {
      return { session: null, ready: true };
    }
  }, [raw]);
}

export function saveAmbassador(s: AmbassadorSession) {
  memorySession = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, memorySession);
  } catch {
    /* private mode: session lives in memory for this tab */
  }
  window.dispatchEvent(new Event(EVENT));
}
export function clearAmbassador() {
  memorySession = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

// ---------- images ----------
/** Load a File, scale its longest side to `max` px, and return a JPEG data URL. */
export async function resizeImage(file: File, max = 900, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// ---------- audio ----------
export interface AudioClip {
  data: string; // base64 (no data: prefix)
  mimeType: string;
  previewUrl: string;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Something went wrong. Please try again.");
  return json as T;
}
