import { z } from "zod";
import { authorizeOwner } from "@/lib/owner";
import { verifyDraftToken } from "@/lib/preview";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { SiteContentSchema, normalizeContent, type BiText, type SiteContent } from "@/lib/schemas";
import { getBusiness, updateContent } from "@/lib/store";

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Who may edit this site's text? The owner, or whoever holds the private draft link while it is still a draft. */
async function canEdit(req: Request, slug: string) {
  const business = await getBusiness(slug);
  if (!business) return { business: null, allowed: false };
  if (!business.published && verifyDraftToken(req.headers.get("x-draft-token"), slug)) return { business, allowed: true };
  return { business, allowed: Boolean(await authorizeOwner(req, slug)) };
}

// GET /api/site?slug=...  -> the full editable content
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const { business, allowed } = await canEdit(req, slug);
  if (!business) return bad("Business not found.", 404);
  if (!allowed) return bad("Please sign in as the owner, or use the private draft link.", 401);
  return Response.json({ content: business.content, altLang: business.altLang, published: business.published, name: business.content.businessName });
}

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

function allStrings(c: SiteContent): string[] {
  const bi = (b: BiText) => [b.en, b.alt];
  return [
    c.businessName, c.category, c.serviceArea, c.cardTagline,
    ...bi(c.tagline), ...bi(c.about), ...bi(c.hours), ...bi(c.announcement),
    ...c.highlights.flatMap(bi),
    ...c.services.flatMap((s) => [...bi(s.name), ...bi(s.description), s.price]),
  ];
}

/** Monolingual sites keep the second language identical to English. */
function mirrorEnglish(c: SiteContent): SiteContent {
  const m = (b: BiText): BiText => ({ en: b.en, alt: b.en });
  return {
    ...c,
    tagline: m(c.tagline), about: m(c.about), hours: m(c.hours), announcement: m(c.announcement),
    highlights: c.highlights.map(m),
    services: c.services.map((s) => ({ ...s, name: m(s.name), description: m(s.description) })),
  };
}

const Body = z.object({ slug: z.string().min(1).max(80), content: SiteContentSchema });

// POST /api/site  {slug, content} -> save a manual edit
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Some fields are missing or too long. Please check the form.");
  const { slug, content } = parsed.data;

  const { business, allowed } = await canEdit(req, slug);
  if (!business) return bad("Business not found.", 404);
  if (!allowed) return bad("Please sign in as the owner, or use the private draft link.", 401);
  if (!rateLimit(`site:${clientIp(req)}`, 40, 10 * 60_000)) return bad("Too many saves. Please wait a few minutes.", 429);

  // Public pages never show private contact details; customers use the message form instead.
  if (allStrings(content).some((t) => EMAIL.test(t) || PHONE.test(t))) {
    return bad("Please remove email addresses and phone numbers. Customers can reach you privately through the message form on your site.");
  }

  let next: SiteContent = { ...content, theme: business.content.theme }; // colours are changed in the portal
  if (business.altLang.code === "en") next = mirrorEnglish(next);
  next = normalizeContent(next);
  await updateContent(slug, next);
  return Response.json({ content: next });
}
