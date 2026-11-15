import { z } from "zod";
import { ensureReadable } from "./color";

/** A string in English plus the same string in the site's second language. */
export const BiText = z.object({
  en: z.string().describe("English text"),
  alt: z.string().describe("Same text in the second language"),
});
export type BiText = z.infer<typeof BiText>;

export const ServiceSchema = z.object({
  name: BiText,
  description: BiText,
  price: z.string().describe('Price exactly as the owner said it, e.g. "$5", or "Ask for a quote" if unknown'),
  emoji: z.string().describe("One emoji that represents this item"),
});

export const ThemeSchema = z.object({
  primary: z.string().describe("Main brand color as a #RRGGBB hex string"),
  accent: z.string().describe("Accent color as a #RRGGBB hex string"),
  emoji: z.string().describe("One emoji that represents the business"),
});

/** The full public website, generated and edited by Gemini. */
export const SiteContentSchema = z.object({
  businessName: z.string(),
  category: z.string().describe('Short category, e.g. "Home bakery", "Math tutoring"'),
  tagline: BiText,
  about: BiText.describe("Two or three warm sentences about the business"),
  services: z.array(ServiceSchema).min(1).max(8),
  highlights: z.array(BiText).min(2).max(4).describe("Short true selling points taken from the interview"),
  hours: BiText.describe('When the owner is available, e.g. "Weekends, by order". "Ask for details" if unknown'),
  serviceArea: z.string().describe('Public area only, e.g. "Mountain House, CA". Never a street address'),
  announcement: BiText.describe("A short current notice for customers, or empty strings if none"),
  theme: ThemeSchema,
  cardTagline: z.string().describe("Max 8 words, shown on the digital business card"),
});

/**
 * Owner-chosen branding. Stored inside the site content JSON (so no database change is needed)
 * and deliberately NOT part of SiteContentSchema, so the AI never generates or overwrites it.
 */
export interface Brand {
  /** Owner-uploaded logo. */
  logoUrl?: string;
  /** Photo of the owner's own printed business card. */
  cardImageUrl?: string;
  /** generated = built from the site, similar = AI-restyled from the owner's card, own = show the owner's card as is. */
  cardMode?: "generated" | "similar" | "own";
  cardStyle?: "gradient" | "light" | "dark";
  cardPrimary?: string;
  cardAccent?: string;
  /** Location line on the card. "" hides it; undefined uses the site's service area. */
  cardLocation?: string;
}
export type SiteContent = z.infer<typeof SiteContentSchema> & { brand?: Brand };

export interface AltLang {
  code: string;
  label: string;
}

export interface Business {
  id: string;
  slug: string;
  content: SiteContent;
  altLang: AltLang;
  photos: string[];
  avatarUrl: string | null;
  ambassadorName: string;
  isDemo: boolean;
  /** Drafts and hidden sites return 404 to the public. */
  published: boolean;
  /** Published sites are public by link; only listed ones appear on the homepage directory. */
  listed: boolean;
  /** Organizer-chosen position on the homepage (1 = first). null = after the ordered ones, newest first. */
  sortOrder: number | null;
  createdAt: string;
}

export interface Certificate {
  id: string;
  studentName: string;
  businessName: string;
  businessSlug: string;
  hours: number;
  status: "pending_advisor_confirmation";
  issuedAt: string;
}

export interface Inquiry {
  id: string;
  name: string;
  contact: string;
  message: string;
  createdAt: string;
}

export interface PublicAmbassador {
  id: string;
  name: string; // "First L."
  languages: string[];
  bio: string;
}

export interface AmbassadorProfile extends PublicAmbassador {
  accepting: boolean;
  demo: boolean;
}

export type RequestStatus = "pending" | "accepted" | "declined" | "completed";

/** An owner's request to be interviewed by a specific ambassador. */
export interface InterviewRequest {
  id: string;
  ambassadorId: string;
  ambassadorName: string;
  ownerEmail: string;
  businessName: string;
  ownerLanguage: string;
  note: string;
  contact: string; // how the owner wants this ambassador to reach them (shared only with that ambassador)
  status: RequestStatus;
  businessSlug: string | null;
  isDemo: boolean;
  createdAt: string;
}

/** What an ambassador or owner may see of a request: never the owner's login email. */
export function publicRequest(r: InterviewRequest): Omit<InterviewRequest, "ownerEmail"> {
  return {
    id: r.id, ambassadorId: r.ambassadorId, ambassadorName: r.ambassadorName, businessName: r.businessName,
    ownerLanguage: r.ownerLanguage, note: r.note, contact: r.contact, status: r.status, businessSlug: r.businessSlug,
    isDemo: r.isDemo, createdAt: r.createdAt,
  };
}

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Clamp model output to safe values so the UI can never break or be abused. */
export function normalizeContent(c: SiteContent): SiteContent {
  const safeHex = (v: string, fallback: string) => (HEX.test(v) ? v : fallback);
  const cap = (s: string, n: number) => (s ?? "").slice(0, n);
  const capBi = (b: BiText, n: number): BiText => ({ en: cap(b.en, n), alt: cap(b.alt, n) });
  return {
    ...c,
    businessName: cap(c.businessName, 80),
    category: cap(c.category, 60),
    tagline: capBi(c.tagline, 140),
    about: capBi(c.about, 700),
    services: c.services.slice(0, 8).map((s) => ({
      name: capBi(s.name, 80),
      description: capBi(s.description, 260),
      price: cap(s.price, 40),
      emoji: cap(s.emoji, 8),
    })),
    highlights: c.highlights.slice(0, 4).map((h) => capBi(h, 120)),
    hours: capBi(c.hours, 120),
    serviceArea: cap(c.serviceArea, 80),
    announcement: capBi(c.announcement, 200),
    theme: {
      primary: ensureReadable(safeHex(c.theme.primary, "#c2410c")),
      accent: ensureReadable(safeHex(c.theme.accent, "#0f766e"), "#0f766e"),
      emoji: cap(c.theme.emoji, 8) || "✨",
    },
    cardTagline: cap(c.cardTagline, 70),
    brand: normalizeBrand(c.brand),
  };
}

// https URLs (Supabase Storage) in production; small data URLs only in local no-database mode.
const safeUrl = (u: unknown) =>
  typeof u === "string" && ((u.length <= 500 && u.startsWith("https://")) || (u.length <= 1_000_000 && /^data:image\/(jpeg|png|webp);base64,/.test(u))) ? u : undefined;

export function normalizeBrand(b: Brand | undefined): Brand | undefined {
  if (!b || typeof b !== "object") return undefined;
  const out: Brand = {};
  const logo = safeUrl(b.logoUrl);
  const card = safeUrl(b.cardImageUrl);
  if (logo) out.logoUrl = logo;
  if (card) out.cardImageUrl = card;
  if (b.cardMode === "generated" || b.cardMode === "similar" || b.cardMode === "own") out.cardMode = b.cardMode;
  if (b.cardStyle === "gradient" || b.cardStyle === "light" || b.cardStyle === "dark") out.cardStyle = b.cardStyle;
  if (typeof b.cardPrimary === "string" && HEX.test(b.cardPrimary)) out.cardPrimary = ensureReadable(b.cardPrimary);
  if (typeof b.cardAccent === "string" && HEX.test(b.cardAccent)) out.cardAccent = ensureReadable(b.cardAccent, "#0f766e");
  if (typeof b.cardLocation === "string") out.cardLocation = b.cardLocation.slice(0, 60);
  if (out.cardMode === "own" && !out.cardImageUrl) out.cardMode = "generated";
  return Object.keys(out).length ? out : undefined;
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const STREET_RE = /\b\d{1,6}\s+[\w .'-]{2,30}\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|cir|circle)\b/i;
/** Public card location must be a city or area, never a street address, phone number or email. */
export function isSafeLocation(s: string): boolean {
  return !EMAIL_RE.test(s) && !PHONE_RE.test(s) && !STREET_RE.test(s);
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "business";
}
