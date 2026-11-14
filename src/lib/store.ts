import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AltLang, Business, Certificate, Inquiry, SiteContent } from "./schemas";
import { slugify } from "./schemas";
import { SEED_BUSINESSES } from "./seed";

/**
 * Persistence layer. Uses Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are set, otherwise an in-memory store (data resets when the server restarts).
 * The service-role key is only ever used here, on the server.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const usingSupabase = Boolean(url && serviceKey);

let _admin: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!url || !serviceKey) throw new Error("Supabase is not configured");
  _admin ??= createClient(url, serviceKey, { auth: { persistSession: false } });
  return _admin;
}

// ---------- in-memory fallback ----------
interface Mem {
  businesses: Map<string, Business>;
  owners: Map<string, string>; // slug -> owner email
  certs: Map<string, Certificate>;
  inquiries: Map<string, Inquiry[]>;
}
const g = globalThis as unknown as { __mh?: Mem };
const mem: Mem = (g.__mh ??= {
  businesses: new Map(SEED_BUSINESSES.map((b) => [b.slug, structuredClone(b)])),
  owners: new Map(),
  certs: new Map(),
  inquiries: new Map(),
});

// ---------- row mapping ----------
type Row = Record<string, unknown>;
const toBusiness = (r: Row): Business => ({
  id: r.id as string,
  slug: r.slug as string,
  content: r.content as SiteContent,
  altLang: r.alt_lang as AltLang,
  photos: (r.photos as string[]) ?? [],
  avatarUrl: (r.avatar_url as string) ?? null,
  ambassadorName: (r.ambassador_name as string) ?? "",
  isDemo: Boolean(r.is_demo),
  createdAt: r.created_at as string,
});

let seeded = false;
async function ensureSeed() {
  if (!usingSupabase || seeded) return;
  seeded = true;
  const rows = SEED_BUSINESSES.map((b) => ({
    slug: b.slug,
    content: b.content,
    alt_lang: b.altLang,
    photos: b.photos,
    avatar_url: b.avatarUrl,
    ambassador_name: b.ambassadorName,
    is_demo: true,
  }));
  // ignoreDuplicates: never overwrite edits made to a demo business
  await admin().from("businesses").upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
}

// ---------- businesses ----------
export async function getBusiness(slug: string): Promise<Business | null> {
  if (!usingSupabase) return mem.businesses.get(slug) ?? null;
  await ensureSeed();
  const { data } = await admin().from("businesses").select("*").eq("slug", slug).maybeSingle();
  return data ? toBusiness(data) : null;
}

export async function listBusinesses(): Promise<Business[]> {
  if (!usingSupabase) return [...mem.businesses.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await ensureSeed();
  const { data } = await admin().from("businesses").select("*").order("created_at", { ascending: false }).limit(60);
  return (data ?? []).map(toBusiness);
}

export async function createBusiness(input: {
  content: SiteContent;
  altLang: AltLang;
  photos: string[];
  ambassadorId: string;
  ambassadorName: string;
  ownerEmail: string;
}): Promise<Business> {
  const slug = `${slugify(input.content.businessName)}-${randomUUID().slice(0, 4)}`;
  if (!usingSupabase) {
    const b: Business = {
      id: randomUUID(),
      slug,
      content: input.content,
      altLang: input.altLang,
      photos: input.photos,
      avatarUrl: null,
      ambassadorName: input.ambassadorName,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    mem.businesses.set(slug, b);
    mem.owners.set(slug, input.ownerEmail.toLowerCase());
    return b;
  }
  const { data, error } = await admin()
    .from("businesses")
    .insert({
      slug,
      content: input.content,
      alt_lang: input.altLang,
      photos: input.photos,
      ambassador_name: input.ambassadorName,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the business");
  await admin().from("business_owners").insert({ business_id: data.id, email: input.ownerEmail.toLowerCase() });
  return toBusiness(data);
}

export async function updateContent(slug: string, content: SiteContent): Promise<void> {
  if (!usingSupabase) {
    const b = mem.businesses.get(slug);
    if (b) b.content = content;
    return;
  }
  await admin().from("businesses").update({ content }).eq("slug", slug);
}

export async function setAvatar(slug: string, avatarUrl: string): Promise<void> {
  if (!usingSupabase) {
    const b = mem.businesses.get(slug);
    if (b) b.avatarUrl = avatarUrl;
    return;
  }
  await admin().from("businesses").update({ avatar_url: avatarUrl }).eq("slug", slug);
}

/** Is this email the registered owner of the business? */
export async function isOwner(slug: string, email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (!usingSupabase) return mem.owners.get(slug) === e;
  const b = await getBusiness(slug);
  if (!b) return false;
  const { data } = await admin().from("business_owners").select("email").eq("business_id", b.id).eq("email", e).maybeSingle();
  return Boolean(data);
}

// ---------- inquiries ----------
export async function addInquiry(slug: string, i: Omit<Inquiry, "id" | "createdAt">): Promise<void> {
  if (!usingSupabase) {
    const list = mem.inquiries.get(slug) ?? [];
    list.unshift({ ...i, id: randomUUID(), createdAt: new Date().toISOString() });
    mem.inquiries.set(slug, list.slice(0, 100));
    return;
  }
  const b = await getBusiness(slug);
  if (!b) return;
  await admin().from("inquiries").insert({ business_id: b.id, name: i.name, contact: i.contact, message: i.message });
}

export async function listInquiries(slug: string): Promise<Inquiry[]> {
  if (!usingSupabase) return mem.inquiries.get(slug) ?? [];
  const b = await getBusiness(slug);
  if (!b) return [];
  const { data } = await admin().from("inquiries").select("*").eq("business_id", b.id).order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    message: r.message,
    createdAt: r.created_at,
  }));
}

// ---------- ambassadors & certificates ----------
export async function recordAmbassador(a: { id: string; name: string; email: string; demo: boolean }): Promise<void> {
  if (!usingSupabase) return;
  await admin()
    .from("ambassadors")
    .upsert({ id: a.id, name: a.name, email: a.email, is_demo: a.demo, badge_awarded_at: new Date().toISOString() });
}

export const SERVICE_HOURS = 2; // estimated: interview + site review

export async function createCertificate(input: {
  ambassadorId: string;
  studentName: string;
  businessName: string;
  businessSlug: string;
  businessId: string;
}): Promise<Certificate> {
  const cert: Certificate = {
    id: randomUUID(),
    studentName: input.studentName,
    businessName: input.businessName,
    businessSlug: input.businessSlug,
    hours: SERVICE_HOURS,
    status: "pending_advisor_confirmation",
    issuedAt: new Date().toISOString(),
  };
  if (!usingSupabase) {
    mem.certs.set(cert.id, cert);
    return cert;
  }
  await admin().from("service_certificates").insert({
    id: cert.id,
    ambassador_id: input.ambassadorId,
    student_name: cert.studentName,
    business_id: input.businessId,
    business_name: cert.businessName,
    business_slug: cert.businessSlug,
    hours: cert.hours,
    status: cert.status,
  });
  return cert;
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  if (!usingSupabase) return mem.certs.get(id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin().from("service_certificates").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    studentName: data.student_name,
    businessName: data.business_name,
    businessSlug: data.business_slug,
    hours: Number(data.hours),
    status: data.status,
    issuedAt: data.issued_at,
  };
}

// ---------- image uploads ----------
const BUCKET = "business-assets";
const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 700_000;

/** True when the string is an image data URL we are willing to store. */
export function parseImageDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_IMAGE_BYTES * 1.4) return null;
  const m = IMAGE_RE.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  return bytes.length <= MAX_IMAGE_BYTES ? { mime: m[1], bytes } : null;
}

/**
 * Store an image and return a URL for it. Uses Supabase Storage when configured,
 * otherwise keeps the (already-resized) data URL so the app works with zero setup.
 */
export async function uploadImage(dataUrl: string, folder: "photos" | "avatars"): Promise<string | null> {
  const img = parseImageDataUrl(dataUrl);
  if (!img) return null;
  if (!usingSupabase) return dataUrl;
  const ext = img.mime === "image/png" ? "png" : img.mime === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${randomUUID()}.${ext}`;
  const { error } = await admin().storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime });
  if (error) {
    // Bucket missing or misconfigured: degrade gracefully instead of failing the interview.
    console.warn("Storage upload failed, falling back to data URL:", error.message);
    return dataUrl;
  }
  return admin().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
