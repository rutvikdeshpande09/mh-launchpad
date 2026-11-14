import { z } from "zod";
import { authorizeOwner } from "@/lib/owner";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { signDraftToken } from "@/lib/preview";
import { ensureReadable, isHex } from "@/lib/color";
import { getBusiness, listInquiries, setAvatar, updateContent, uploadImage } from "@/lib/store";

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
]);

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

  const url = await uploadImage(body.dataUrl, "avatars");
  if (!url) return Response.json({ error: "Please use a JPG, PNG or WebP image under 700 KB." }, { status: 400 });
  await setAvatar(body.slug, url);
  return Response.json({ avatarUrl: url });
}
