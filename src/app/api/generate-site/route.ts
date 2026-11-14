import type { Part } from "@google/genai";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import { AiConfigError, SAFETY_RULES, generateJson } from "@/lib/gemini";
import { QUESTIONS } from "@/lib/content";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { canMock, mockSite } from "@/lib/mock";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { SiteContentSchema, normalizeContent } from "@/lib/schemas";
import { signDraftToken } from "@/lib/preview";
import { createBusiness, createCertificate, getRequest, parseImageDataUrl, updateRequest, usingSupabase } from "@/lib/store";

export const maxDuration = 60; // Gemini audio + structured output can take a while

const langCodes = LANGUAGES.map((l) => l.code) as [string, ...string[]];
const Answer = z.object({
  text: z.string().max(1500).optional(),
  audio: z.object({ data: z.string().max(600_000), mimeType: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i) }).optional(),
});
const Body = z.object({
  token: z.string(),
  language: z.enum(langCodes), // language the owner speaks in the interview
  altLanguage: z.enum(langCodes), // second language shown on the site
  ownerEmail: z.string().email().max(120).optional(), // not needed when answering an owner's request
  requestId: z.string().min(1).max(64).optional(),
  consent: z.literal(true),
  answers: z.array(Answer).length(5),
  photos: z.array(z.string().max(1_000_000)).max(3),
});

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Please complete all 5 answers, add the owner's email, and confirm consent.");
  const b = parsed.data;

  const ambassador = verifyToken(b.token);
  if (!ambassador) return bad("Your session expired. Please sign in again as a Tech Ambassador.", 401);

  // If this interview answers an owner's request, the owner's account email comes from the request.
  let ownerEmail = b.ownerEmail;
  let request = null;
  if (b.requestId) {
    request = await getRequest(b.requestId);
    if (!request || request.ambassadorId !== ambassador.id) return bad("That interview request wasn't found.", 404);
    if (request.status !== "accepted") return bad("Accept the request before interviewing, or it was already completed.", 409);
    ownerEmail = request.ownerEmail;
  }
  if (!ownerEmail) return bad("Please add the owner's email.");
  if (!rateLimit(`gen:${clientIp(req)}`, 6, 30 * 60_000) || !rateLimit(`gen:${ambassador.id}`, 4, 30 * 60_000)) {
    return bad("You've generated several sites recently. Please wait a bit before making another.", 429);
  }
  if (b.answers.some((a) => !a.text?.trim() && !a.audio)) return bad("Every question needs a text or voice answer.");

  // Only accept photos we can safely store/display: resized image data URLs or our own storage URLs.
  const supaHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
  const photos = b.photos.filter((p) => {
    if (p.startsWith("data:")) return Boolean(parseImageDataUrl(p));
    try {
      const u = new URL(p);
      return u.protocol === "https:" && usingSupabase && u.host === supaHost;
    } catch {
      return false;
    }
  });

  const spoken = getLanguage(b.language);
  const alt = getLanguage(b.altLanguage);
  const bilingual = alt.code !== "en";

  try {
    let content;
    if (canMock()) {
      content = mockSite("Mock Business", b.answers.map((a) => a.text ?? ""));
    } else {
      const parts: Part[] = [
        {
          text: `Interview with a home-based business owner, conducted by a student volunteer. The owner answered in ${spoken.label}. Answers may be typed or recorded audio; transcribe and understand any audio.${
            request ? ` The owner registered the business name as "${request.businessName}"; use that exact name.` : ""
          }`,
        },
      ];
      b.answers.forEach((a, i) => {
        parts.push({ text: `\nQuestion ${i + 1}: ${QUESTIONS[i]}` });
        if (a.text?.trim()) parts.push({ text: `Answer (typed): ${a.text.trim()}` });
        if (a.audio) {
          parts.push({ text: `Answer ${i + 1} (spoken audio in ${spoken.label}):` });
          parts.push({ inlineData: { data: a.audio.data, mimeType: a.audio.mimeType.split(";")[0] } });
        }
      });

      const generated = await generateJson({
        system: `You turn a short interview into the complete content of a small-business website.
Every text field has an "en" (English) value and an "alt" value in ${bilingual ? `${alt.label}` : "English (identical to en)"}.
Choose a warm theme: two #RRGGBB colors with good contrast against white text on the primary, and one emoji.
Set "announcement" to empty strings unless the owner announced something time-sensitive.
${SAFETY_RULES}`,
        parts,
        schema: SiteContentSchema,
        temperature: 0.5,
      });
      content = generated;
    }

    content = normalizeContent(content);
    const business = await createBusiness({
      content,
      altLang: { code: alt.code, label: alt.label },
      photos,
      ambassadorId: ambassador.id,
      ambassadorName: ambassador.name,
      ownerEmail,
      isDemo: ambassador.demo, // sites made through judge demo access are labelled demo
    });
    const certificate = await createCertificate({
      ambassadorId: ambassador.id,
      studentName: ambassador.demo ? `${ambassador.name} (demo)` : ambassador.name,
      businessName: content.businessName,
      businessSlug: business.slug,
      businessId: business.id,
    });
    if (request) await updateRequest(request.id, { status: "completed", businessSlug: business.slug });
    return Response.json({ slug: business.slug, certificateId: certificate.id, draftToken: signDraftToken(business.slug) });
  } catch (e) {
    if (e instanceof AiConfigError) return bad(e.message, 503);
    console.error("generate-site failed", e);
    return bad("Something went wrong while generating the site. Please try again.", 502);
  }
}
