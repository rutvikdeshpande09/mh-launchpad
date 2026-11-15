// Pure colour helpers shared by the browser (live preview) and the server (what gets saved),
// so the preview always matches the saved result.

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export const isHex = (v: string) => HEX6.test(v);

function toRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between white text and this colour (1 to 21). */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** The site puts white text on both brand colours, so keep each dark enough to read (3.2:1 or better). */
export function ensureReadable(hex: string, fallback = "#c2410c"): string {
  if (!isHex(hex)) return fallback;
  let rgb = toRgb(hex);
  for (let i = 0; i < 40 && contrastWithWhite(toHex(rgb)) < 3.2; i++) {
    rgb = [rgb[0] * 0.93, rgb[1] * 0.93, rgb[2] * 0.93];
  }
  return toHex(rgb);
}

export interface Palette {
  name: string;
  primary: string;
  accent: string;
}

export const PRESETS: Palette[] = [
  { name: "Terracotta", primary: "#c2410c", accent: "#0f766e" },
  { name: "Ocean", primary: "#1d4ed8", accent: "#0e7490" },
  { name: "Forest", primary: "#166534", accent: "#a16207" },
  { name: "Berry", primary: "#9d174d", accent: "#6d28d9" },
  { name: "Sunset", primary: "#b91c1c", accent: "#c2410c" },
  { name: "Royal", primary: "#4338ca", accent: "#be185d" },
  { name: "Slate", primary: "#334155", accent: "#b45309" },
  { name: "Teal", primary: "#0f766e", accent: "#1d4ed8" },
  { name: "Coffee", primary: "#78350f", accent: "#b45309" },
  { name: "Plum", primary: "#7e22ce", accent: "#be123c" },
  { name: "Emerald", primary: "#047857", accent: "#0369a1" },
  { name: "Midnight", primary: "#1e293b", accent: "#6d28d9" },
  { name: "Rose", primary: "#be123c", accent: "#9a3412" },
  { name: "Sage", primary: "#4d7c0f", accent: "#0f766e" },
];
