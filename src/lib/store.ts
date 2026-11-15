import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AltLang, AmbassadorProfile, Business, Certificate, Inquiry, InterviewRequest, PublicAmbassador, RequestStatus, SiteContent } from "./schemas";
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
interface AmbRec extends AmbassadorProfile {
  email: string;
  passcodeHash: string | null;
}
interface Mem {
  ambassadors: Map<string, AmbRec>;
  requests: Map<string, InterviewRequest>;
  businesses: Map<string, Business>;
  owners: Map<string, string>; // slug -> owner email
  certs: Map<string, Certificate>;
  certAmb: Map<string, string>; // certificate id -> ambassador id (so ambassadors can find what they created)
  inquiries: Map<string, Inquiry[]>;
}
const g = globalThis as unknown as { __mh?: Mem };
const mem: Mem = (g.__mh ??= {
  ambassadors: new Map(),
  requests: new Map(),
  businesses: new Map(SEED_BUSINESSES.map((b) => [b.slug, structuredClone(b)])),
  owners: new Map(),
  certs: new Map(),
  certAmb: new Map(),
  inquiries: new Map(),
});

mem.ambassadors ??= new Map(); // dev hot-reload may hold an older shape
mem.requests ??= new Map();
mem.certAmb ??= new Map();

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
  published: r.published !== false, // column may not exist before the migration: treat as published
  listed: r.listed !== false, // column may not exist before the migration: treat as listed
  sortOrder: typeof r.sort_order === "number" ? (r.sort_order as number) : null,
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

/** Organizer's order first (1, 2, 3 ...), then everything else newest first. */
const byDisplayOrder = (a: Business, b: Business) => {
  const x = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const y = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  return x !== y ? x - y : b.createdAt.localeCompare(a.createdAt);
};

/** Public directory: only published AND listed sites, in the organizer's order. */
export async function listBusinesses(): Promise<Business[]> {
  if (!usingSupabase) return [...mem.businesses.values()].filter((b) => b.published && b.listed).sort(byDisplayOrder);
  await ensureSeed();
  const { data } = await admin().from("businesses").select("*").order("created_at", { ascending: false }).limit(200);
  return (data ?? []).map(toBusiness).filter((b) => b.published && b.listed).sort(byDisplayOrder);
}

/** Organizer view: every site, published or not. */
export async function listAllBusinesses(): Promise<Business[]> {
  if (!usingSupabase) return [...mem.businesses.values()].sort(byDisplayOrder);
  await ensureSeed();
  const { data } = await admin().from("businesses").select("*").order("created_at", { ascending: false }).limit(500);
  return (data ?? []).map(toBusiness).sort(byDisplayOrder);
}

/** Save the homepage order: the given slugs become positions 1..n. Returns false if it could not be saved. */
export async function setSortOrders(slugs: string[]): Promise<boolean> {
  if (!usingSupabase) {
    slugs.forEach((slug, i) => {
      const b = mem.businesses.get(slug);
      if (b) b.sortOrder = i + 1;
    });
    return true;
  }
  for (let i = 0; i < slugs.length; i++) {
    const { error } = await admin().from("businesses").update({ sort_order: i + 1 }).eq("slug", slugs[i]);
    if (error) {
      console.warn("setSortOrders failed:", error.message);
      return false;
    }
  }
  return true;
}

/** Permanently delete a site (its owner link and messages go with it). */
export async function deleteBusiness(slug: string): Promise<boolean> {
  if (!usingSupabase) return mem.businesses.delete(slug);
  const { error } = await admin().from("businesses").delete().eq("slug", slug);
  if (error) console.warn("deleteBusiness failed:", error.message);
  return !error;
}

/** Is this email allowed to organize the whole website? (rows in the organizers table) */
export async function isOrganizerEmail(email: string): Promise<boolean> {
  if (!usingSupabase) return false;
  const { data } = await admin().from("organizers").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return Boolean(data);
}

export async function createBusiness(input: {
  content: SiteContent;
  altLang: AltLang;
  photos: string[];
  ambassadorId: string;
  ambassadorName: string;
  ownerEmail: string;
  isDemo?: boolean;
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
      isDemo: Boolean(input.isDemo),
      published: false, // new sites start as private drafts until approved
      listed: true,
      sortOrder: null,
      createdAt: new Date().toISOString(),
    };
    mem.businesses.set(slug, b);
    mem.owners.set(slug, input.ownerEmail.toLowerCase());
    return b;
  }
  const row = {
    slug,
    content: input.content,
    alt_lang: input.altLang,
    photos: input.photos,
    ambassador_name: input.ambassadorName,
    is_demo: Boolean(input.isDemo),
  };
  let res = await admin().from("businesses").insert({ ...row, published: false }).select("*").single();
  if (res.error && /published/i.test(res.error.message)) {
    // Migration not applied yet: fall back to the old behaviour (visible immediately) instead of failing.
    console.warn("businesses.published column missing; run the migration in supabase/schema.sql");
    res = await admin().from("businesses").insert(row).select("*").single();
  }
  const { data, error } = res;
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

/** Publish or hide a site. Returns false if it could not be saved. */
export async function setPublished(slug: string, published: boolean): Promise<boolean> {
  if (!usingSupabase) {
    const b = mem.businesses.get(slug);
    if (b) b.published = published;
    return Boolean(b);
  }
  const { error } = await admin().from("businesses").update({ published }).eq("slug", slug);
  if (error) console.warn("setPublished failed:", error.message);
  return !error;
}

/** Show or hide a published site in the homepage directory. Unlisted sites stay reachable by direct link. */
export async function setListed(slug: string, listed: boolean): Promise<boolean> {
  if (!usingSupabase) {
    const b = mem.businesses.get(slug);
    if (b) b.listed = listed;
    return Boolean(b);
  }
  const { error } = await admin().from("businesses").update({ listed }).eq("slug", slug);
  if (error) console.warn("setListed failed:", error.message);
  return !error;
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
export interface AmbassadorRecord extends AmbassadorProfile {
  email: string;
  passcodeHash: string | null;
}

const toAmb = (r: Row): AmbassadorRecord => ({
  id: r.id as string,
  name: r.name as string,
  email: (r.email as string) ?? "",
  demo: Boolean(r.is_demo),
  languages: (r.languages as string[]) ?? [],
  bio: (r.bio as string) ?? "",
  accepting: Boolean(r.accepting),
  passcodeHash: (r.passcode_hash as string) ?? null,
});

/** Create or update (by id) an ambassador account. */
export async function saveAmbassador(a: { id: string; name: string; email: string; demo: boolean; passcodeHash: string | null }): Promise<void> {
  if (!usingSupabase) {
    const prev = mem.ambassadors.get(a.id);
    mem.ambassadors.set(a.id, {
      languages: [], bio: "", accepting: false, ...prev,
      id: a.id, name: a.name, email: a.email, demo: a.demo, passcodeHash: a.passcodeHash,
    });
    return;
  }
  await admin().from("ambassadors").upsert({
    id: a.id, name: a.name, email: a.email, is_demo: a.demo, passcode_hash: a.passcodeHash, badge_awarded_at: new Date().toISOString(),
  });
}

export async function getAmbassadorByEmail(email: string): Promise<AmbassadorRecord | null> {
  const e = email.trim().toLowerCase();
  if (!usingSupabase) return [...mem.ambassadors.values()].find((a) => !a.demo && a.email === e) ?? null;
  const { data } = await admin().from("ambassadors").select("*").eq("email", e).eq("is_demo", false).limit(1).maybeSingle();
  return data ? toAmb(data) : null;
}

export async function getAmbassador(id: string): Promise<AmbassadorRecord | null> {
  if (!usingSupabase) return mem.ambassadors.get(id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin().from("ambassadors").select("*").eq("id", id).maybeSingle();
  return data ? toAmb(data) : null;
}

export async function updateAmbassadorProfile(id: string, p: { languages: string[]; bio: string; accepting: boolean }): Promise<boolean> {
  if (!usingSupabase) {
    const a = mem.ambassadors.get(id);
    if (!a) return false;
    Object.assign(a, p);
    return true;
  }
  const { error } = await admin().from("ambassadors").update({ languages: p.languages, bio: p.bio, accepting: p.accepting }).eq("id", id);
  if (error) console.warn("updateAmbassadorProfile failed:", error.message);
  return !error;
}

/** Public directory of ambassadors who are accepting requests. Real and demo pools never mix. */
export async function listPublicAmbassadors(demo: boolean): Promise<PublicAmbassador[]> {
  if (!usingSupabase) {
    return [...mem.ambassadors.values()]
      .filter((a) => a.accepting && a.demo === demo)
      .map(({ id, name, languages, bio }) => ({ id, name, languages, bio }));
  }
  const { data } = await admin()
    .from("ambassadors")
    .select("id,name,languages,bio")
    .eq("accepting", true)
    .eq("is_demo", demo)
    .order("badge_awarded_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, languages: r.languages ?? [], bio: r.bio ?? "" }));
}

// ---------- interview requests ----------
const toRequest = (r: Row): InterviewRequest => ({
  id: r.id as string,
  ambassadorId: r.ambassador_id as string,
  ambassadorName: (r.ambassador_name as string) ?? "",
  ownerEmail: r.owner_email as string,
  businessName: r.business_name as string,
  ownerLanguage: (r.owner_language as string) ?? "en",
  note: (r.note as string) ?? "",
  contact: (r.contact as string) ?? "",
  status: r.status as RequestStatus,
  businessSlug: (r.business_slug as string) ?? null,
  isDemo: Boolean(r.is_demo),
  createdAt: r.created_at as string,
});

export async function createRequest(i: Omit<InterviewRequest, "id" | "status" | "businessSlug" | "createdAt">): Promise<InterviewRequest> {
  if (!usingSupabase) {
    const r: InterviewRequest = { ...i, id: randomUUID(), status: "pending", businessSlug: null, createdAt: new Date().toISOString() };
    mem.requests.set(r.id, r);
    return r;
  }
  const { data, error } = await admin()
    .from("interview_requests")
    .insert({
      ambassador_id: i.ambassadorId, ambassador_name: i.ambassadorName, owner_email: i.ownerEmail.toLowerCase(),
      business_name: i.businessName, owner_language: i.ownerLanguage, note: i.note, contact: i.contact, is_demo: i.isDemo,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the request");
  return toRequest(data);
}

export async function getRequest(id: string): Promise<InterviewRequest | null> {
  if (!usingSupabase) return mem.requests.get(id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin().from("interview_requests").select("*").eq("id", id).maybeSingle();
  return data ? toRequest(data) : null;
}

export async function listRequestsForAmbassador(id: string): Promise<InterviewRequest[]> {
  if (!usingSupabase) return [...mem.requests.values()].filter((r) => r.ambassadorId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await admin().from("interview_requests").select("*").eq("ambassador_id", id).order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map(toRequest);
}

export async function listRequestsForOwner(email: string): Promise<InterviewRequest[]> {
  const e = email.toLowerCase();
  if (!usingSupabase) return [...mem.requests.values()].filter((r) => r.ownerEmail.toLowerCase() === e).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await admin().from("interview_requests").select("*").eq("owner_email", e).order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map(toRequest);
}

export async function updateRequest(id: string, patch: { status?: RequestStatus; businessSlug?: string }): Promise<void> {
  if (!usingSupabase) {
    const r = mem.requests.get(id);
    if (r) Object.assign(r, patch);
    return;
  }
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.businessSlug) row.business_slug = patch.businessSlug;
  await admin().from("interview_requests").update(row).eq("id", id);
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
    mem.certAmb.set(cert.id, input.ambassadorId);
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

// ---------- "my creations" ----------
/** Sites an ambassador interviewed for (drafts and hidden ones included: they are theirs). */
export async function listCreationsForAmbassador(ambassadorId: string): Promise<Business[]> {
  if (!usingSupabase) {
    const slugs = [...mem.certAmb.entries()].filter(([, a]) => a === ambassadorId).map(([id]) => mem.certs.get(id)?.businessSlug);
    return slugs.map((sl) => (sl ? mem.businesses.get(sl) : undefined)).filter((b): b is Business => Boolean(b)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (!/^[0-9a-f-]{36}$/i.test(ambassadorId)) return [];
  const { data: certs } = await admin().from("service_certificates").select("business_slug").eq("ambassador_id", ambassadorId);
  const slugs = [...new Set((certs ?? []).map((c) => c.business_slug as string))];
  if (slugs.length === 0) return [];
  const { data } = await admin().from("businesses").select("*").in("slug", slugs).order("created_at", { ascending: false });
  return (data ?? []).map(toBusiness);
}

/** Sites a signed-in owner owns. */
export async function listBusinessesForOwner(email: string): Promise<Business[]> {
  const e = email.toLowerCase();
  if (!usingSupabase) {
    return [...mem.owners.entries()].filter(([, o]) => o === e).map(([sl]) => mem.businesses.get(sl)).filter((b): b is Business => Boolean(b));
  }
  const { data: owned } = await admin().from("business_owners").select("business_id").eq("email", e);
  const ids = (owned ?? []).map((o) => o.business_id as string);
  if (ids.length === 0) return [];
  const { data } = await admin().from("businesses").select("*").in("id", ids).order("created_at", { ascending: false });
  return (data ?? []).map(toBusiness);
}
