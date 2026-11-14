"use client";

import { motion, useReducedMotion } from "framer-motion";
import { toPng } from "html-to-image";
import { Download, RotateCw, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { forwardRef, useEffect, useRef, useState } from "react";
import Tilt from "./Tilt";

export interface CardData {
  name: string;
  tagline: string;
  area: string;
  emoji: string;
  primary: string;
  accent: string;
  avatarUrl: string | null;
  items: string[];
  hours: string;
  slug: string;
}

const W = 380;
const H = 224;

function Avatar({ data, size }: { data: CardData; size: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-white/20"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {data.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <span>{data.emoji}</span>
      )}
    </div>
  );
}

/** Flat (non-3D) faces. Also used off-screen for crisp PNG export. */
const Front = forwardRef<HTMLDivElement, { data: CardData; qr: string }>(function Front({ data, qr }, ref) {
  return (
    <div
      ref={ref}
      className="relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white"
      style={{ width: W, height: H, background: `linear-gradient(135deg, ${data.primary}, ${data.accent})` }}
    >
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-14 left-10 size-36 rounded-full bg-black/10" />
      <div className="relative flex items-center gap-3">
        <Avatar data={data} size={64} />
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold leading-tight">{data.name}</p>
          <p className="text-sm text-white/85">{data.tagline}</p>
        </div>
      </div>
      <div className="relative flex items-end justify-between gap-3">
        <div className="text-xs text-white/90">
          <p className="font-semibold">📍 {data.area}</p>
          <p>Scan to see the full site →</p>
        </div>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code linking to this business's website" className="size-[76px] rounded-lg bg-white p-1" />
        )}
      </div>
    </div>
  );
});

const Back = forwardRef<HTMLDivElement, { data: CardData }>(function Back({ data }, ref) {
  return (
    <div
      ref={ref}
      className="relative flex flex-col justify-between overflow-hidden rounded-2xl p-5"
      style={{ width: W, height: H, background: "#fff", border: `3px solid ${data.primary}`, color: "#1f2430" }}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: data.primary }}>
          What we offer
        </p>
        <ul className="mt-2 space-y-1 text-sm font-medium">
          {data.items.slice(0, 4).map((i) => (
            <li key={i} className="truncate">
              • {i}
            </li>
          ))}
        </ul>
      </div>
      <div className="text-xs" style={{ color: "#5b6270" }}>
        <p>🕒 {data.hours}</p>
        <p className="mt-1 font-semibold" style={{ color: data.accent }}>
          Message us through our MH Launchpad page
        </p>
      </div>
    </div>
  );
});

export default function BusinessCard3D({ data }: { data: CardData }) {
  const [flipped, setFlipped] = useState(false);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const exportFront = useRef<HTMLDivElement>(null);
  const exportBack = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const u = `${window.location.origin}/sites/${data.slug}`;
    QRCode.toDataURL(u, { margin: 1, width: 240, color: { dark: "#1f2430", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [data.slug]);

  async function download(side: "front" | "back") {
    const node = side === "front" ? exportFront.current : exportBack.current;
    if (!node) return;
    setBusy(true);
    try {
      const png = await toPng(node, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = png;
      a.download = `${data.slug}-card-${side}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/sites/${data.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: data.name, text: data.tagline, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    alert("Link copied!");
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Tilt max={12} className="rounded-2xl">
        <motion.button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label="Flip the business card"
          className="preserve-3d relative block cursor-pointer rounded-2xl shadow-2xl"
          style={{ width: W, height: H, maxWidth: "100%" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 16 }}
        >
          <div className="backface-hidden absolute inset-0">
            <Front data={data} qr={qr} />
          </div>
          <div className="backface-hidden absolute inset-0" style={{ transform: "rotateY(180deg)" }}>
            <Back data={data} />
          </div>
        </motion.button>
      </Tilt>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => setFlipped((f) => !f)}>
          <RotateCw size={16} /> Flip
        </button>
        <button type="button" className="btn btn-ghost !py-2 text-sm" disabled={busy} onClick={() => download("front")}>
          <Download size={16} /> Front PNG
        </button>
        <button type="button" className="btn btn-ghost !py-2 text-sm" disabled={busy} onClick={() => download("back")}>
          <Download size={16} /> Back PNG
        </button>
        <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={share}>
          <Share2 size={16} /> Share
        </button>
      </div>

      {/* Off-screen flat copies used only for PNG export (3D transforms break image capture). */}
      <div aria-hidden className="pointer-events-none fixed -left-[9999px] top-0">
        <Front ref={exportFront} data={data} qr={qr} />
        <Back ref={exportBack} data={data} />
      </div>
    </div>
  );
}
