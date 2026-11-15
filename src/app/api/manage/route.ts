import type { Part } from "@google/genai";
import { z } from "zod";
import { AiConfigError, SAFETY_RULES, generateJson } from "@/lib/gemini";
import { canMock } from "@/lib/mock";
import { authorizeOwner } from "@/lib/owner";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { signDraftToken } from "@/lib/preview";
import { ensureReadable, isHex } from "@/lib/color";
import { isSafeLocation, normalizeBrand, type Brand } from "@/lib/schemas";
import { getBusiness, listInquiries, parseImageDataUrl, setAvatar, updateContent, uploadImage, usingSupabase } from "@/lib/store";

export const maxDuration = 60;

// GET  /api/manage?slug=...  -> private inquiries for the signed-in owner
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const session = await authorizeOwner(req, slug);
  if (!session) return Response.json({ error: "Please sign in as the owner of this business." }, { status: 401 });
  return Response.json({ inquiries: await listInquiries(slug), draftToken: signDraftToken(slug) });
}

const Body = z.discriminatedUnion("action", [
  z.object({ slug: z.string().min(1).max(80), action: z.literal("avatar"), dataUrl: z.string() }),
  z.object({ slug: z.string().min(1).max(80), action: z.literal("theme"), primary: z.string(), accent: z.string() }),
  z.object({ slug: z.string().min(1).max(80), action: z.literal("logo"), dataUrl: z.string() }),
  z.object({ slug: z.string().min(1).max(80), action: z.literal("remove-logo") }),
  z.object({ slug: z.string().min(1).max(80), action: z.literal("card-upload"), dataUrl: z.string() }),
  z.object({
    slug: z.string().min(1).max(80),
    action: z.literal("card-settings"),
    mode: z.enum(["generated", "similar", "own"]).optional(),
    style: z.enum(["gradient", "light", "dark"]).optional(),
    location: z.string().max(60).optional(), // "" hides the location line
    reset: z.boolean().optional(),
  }),
  z.object({
    slug: z.string().min(1).max(80),
    action: z.literal("card-similar"),
    preference: z.string().max(400).optional(),
    location: z.string().max(60).optional(),
  }),
  z.object({ slug: z.string().min(1).max(80), action: z.literal("suggest-colors"), request: z.string().min(2).max(300) }),
]);

const SimilarResult = z.object({
  style: z.enum(["gradient", "light", "dark"]).describe("gradient = bold colour background with white text; light = white card with a coloured border; dark = near-black card with colour highlights. Pick the one closest to the card in the photo."),
  primary: z.string().describe("Main colour of the card in the photo as #RRGGBB (adjusted by the owner's preference if given)"),
  accent: z.string().describe("Second colour as #RRGGBB"),
  cardTagline: z.string().describe("Max 8 words, in the spirit of the card; no phone numbers, emails or addresses"),
  note: z.string().describe("One friendly sentence describing how the new card resembles theirs and what was changed"),
});

const ColorResult = z.object({
  name: z.string().describe("A short friendly name for this colour scheme, max 3 words"),
  primary: z.string().describe("Main brand colour as #RRGGBB, dark enough for white text"),
  accent: z.string().describe("Accent colour as #RRGGBB, dark enough for white text"),
  explanation: z.string().describe("One friendly sentence on how this matches the request"),
});

/** Load an owner's stored card image for the AI: a data URL or one of our own storage URLs. */
async function loadImagePart(url: string): Promise<Part | null> {
  const direct = parseImageDataUrl(url);
  if (direct) return { inlineData: { data: direct.bytes.toString("base64"), mimeType: direct.mime } };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !url.startsWith(`${base}/storage/v1/object/public/`)) return null; // never fetch arbitrary URLs
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (buf.length > 1_500_000 || !/^image\/(jpeg|png|webp)$/.test(mime)) return null;
  return { inlineData: { data: buf.toString("base64"), mimeType: mime } };
}

const err = (message: string, status = 400) => Response.json({ error: message }, { status });

// POST /api/manage {action:"avatar"} -> saves the cropped profile photo
// POST /api/manage {action:"theme"}  -> saves the site colours
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  const session = await authorizeOwner(req, body.slug);
  if (!session) return Response.json({ error: "Please sign in as the owner of this business." }, { status: 401 });
  if (!rateLimit(`manage:${clientIp(req)}`, 20, 10 * 60_000)) return Response.json({ error: "Too many changes. Please wait a few minutes." }, { status: 429 });

  if (body.action === "theme") {
    if (!isHex(body.primary) || !isHex(body.accent)) return Response.json({ error: "Please choose valid colours." }, { status: 400 });
    const business = await getBusiness(body.slug);
    if (!business) return Response.json({ error: "Business not found." }, { status: 404 });
    // Same adjustment the live preview applies: keep colours dark enough for white text.
    const theme = { ...business.content.theme, primary: ensureReadable(body.primary), accent: ensureReadable(body.accent) };
    await updateContent(body.slug, { ...business.content, theme });
    return Response.json({ theme });
  }

  if (body.action === "avatar") {
    const url = await uploadImage(body.dataUrl, "avatars");
    if (!url) return err("Please use a JPG, PNG or WebP image under 700 KB.");
    await setAvatar(body.slug, url);
    return Response.json({ avatarUrl: url });
  }

  const business = await getBusiness(body.slug);
  if (!business) return err("Business not found.", 404);
  const brand: Brand = { ...(business.content.brand ?? {}) };
  const save = async (next: Brand) => {
    const content = { ...business.content, brand: normalizeBrand(next) };
    await updateContent(body.slug, content);
    return Response.json({ brand: content.brand ?? {}, content });
  };

  if (body.action === "logo") {
    const url = await uploadImage(body.dataUrl, "logos");
    if (!url) return err("Please use a JPG, PNG or WebP logo under 700 KB.");
    if (usingSupabase && !url.startsWith("https://")) return err("Image storage is unavailable right now. Please try again later.", 503);
    return save({ ...brand, logoUrl: url });
  }
  if (body.action === "remove-logo") {
    delete brand.logoUrl;
    return save(brand);
  }
  if (body.action === "card-upload") {
    const url = await uploadImage(body.dataUrl, "cards");
    if (!url) return err("Please use a JPG, PNG or WebP photo of your card under 700 KB.");
    if (usingSupabase && !url.startsWith("https://")) return err("Image storage is unavailable right now. Please try again later.", 503);
    return save({ ...brand, cardImageUrl: url, cardMode: "own" });
  }
  if (body.action === "card-settings") {
    if (body.reset) return save({ logoUrl: brand.logoUrl, cardImageUrl: brand.cardImageUrl, cardMode: "generated" });
    if (body.location !== undefined) {
      const loc = body.location.trim();
      if (!isSafeLocation(loc)) return err("Please use only a city or area here (for example “Mountain House, CA”), not a street address, phone number or email.");
      brand.cardLocation = loc;
    }
    if (body.mode) {
      if (body.mode === "own" && !brand.cardImageUrl) return err("Upload a photo of your card first.");
      brand.cardMode = body.mode;
    }
    if (body.style) brand.cardStyle = body.style;
    return save(brand);
  }

  if (!rateLimit(`manage-ai:${clientIp(req)}`, 10, 10 * 60_000)) return err("Too many AI requests. Please wait a few minutes.", 429);

  try {
    if (body.action === "suggest-colors") {
      let r: z.infer<typeof ColorResult>;
      if (canMock()) r = { name: "Custom", primary: "#9d174d", accent: "#0f766e", explanation: "Dev mock colours." };
      else {
        r = await generateJson({
          system: `You are a friendly brand designer for tiny local businesses. The owner describes the colour scheme they want (any language). Choose a main colour and an accent colour that fit the request and the type of business.
Both colours must be dark or medium-dark (white text sits on top of them): avoid pastels and near-white colours; if the owner asks for "pastel" or "light", choose the deepest tasteful version of that hue.
${SAFETY_RULES}`,
          parts: [{ text: `Business: ${business.content.businessName} (${business.content.category}). Current colours: ${business.content.theme.primary} and ${business.content.theme.accent}.\nThe owner's request:` }, { text: body.request.trim() }],
          schema: ColorResult,
          temperature: 0.6,
        });
      }
      return Response.json({
        name: r.name.slice(0, 40),
        primary: ensureReadable(r.primary),
        accent: ensureReadable(r.accent, "#0f766e"),
        explanation: r.explanation.slice(0, 240),
      });
    }

    // card-similar
    if (!brand.cardImageUrl) return err("Upload a photo of your card first.");
    const imagePart = await loadImagePart(brand.cardImageUrl);
    if (!imagePart) return err("We couldn't read your card photo. Please upload it again.");
    const location = body.location?.trim();
    if (location !== undefined && !isSafeLocation(location)) return err("Please use only a city or area for the location, not a street address, phone number or email.");
    let r: z.infer<typeof SimilarResult>;
    if (canMock()) r = { style: "light", primary: "#9d174d", accent: "#0f766e", cardTagline: business.content.cardTagline, note: "Dev mock card." };
    else {
      r = await generateJson({
        system: `You restyle a small business's digital card to look like the owner's own printed card. You receive a photo of their card and optional preferences (any language).
Describe ONLY the visual style: pick the closest card style, the card's main and accent colours, and a short tagline in the spirit of the card. Apply the owner's preferences (e.g. "make it darker", "more playful") to the colours and style.
NEVER copy phone numbers, email addresses, street addresses, websites or anyone's personal name from the photo into any output field.
${SAFETY_RULES}`,
        parts: [
          imagePart,
          { text: `Business: ${business.content.businessName} (${business.content.category}). Current tagline: ${business.content.cardTagline}.` },
          { text: `The owner's preferences: ${body.preference?.trim() || "(none, just make it similar)"}` },
        ],
        schema: SimilarResult,
        temperature: 0.4,
      });
    }
    const tagline = r.cardTagline.slice(0, 70);
    const taglineOk = isSafeLocation(tagline) && !/@|https?:|www\./i.test(tagline);
    const content = {
      ...business.content,
      cardTagline: taglineOk && tagline.trim() ? tagline : business.content.cardTagline,
      brand: normalizeBrand({
        ...brand,
        cardMode: "similar",
        cardStyle: r.style,
        cardPrimary: r.primary,
        cardAccent: r.accent,
        ...(location !== undefined ? { cardLocation: location } : {}),
      }),
    };
    await updateContent(body.slug, content);
    return Response.json({ brand: content.brand ?? {}, content, note: r.note.slice(0, 240) });
  } catch (e) {
    if (e instanceof AiConfigError) return err(e.message, 503);
    console.error("manage AI failed", e);
    return err("The AI couldn't do that just now. Please try again in a moment.", 502);
  }
}
