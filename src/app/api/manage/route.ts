import { z } from "zod";
import { authorizeOwner } from "@/lib/owner";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { signDraftToken } from "@/lib/preview";
import { listInquiries, setAvatar, uploadImage } from "@/lib/store";

// GET  /api/manage?slug=...  -> private inquiries for the signed-in owner
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const session = await authorizeOwner(req, slug);
  if (!session) return Response.json({ error: "Please sign in as the owner of this business." }, { status: 401 });
  return Response.json({ inquiries: await listInquiries(slug), draftToken: signDraftToken(slug) });
}

const Avatar = z.object({ slug: z.string().min(1).max(80), action: z.literal("avatar"), dataUrl: z.string() });

// POST /api/manage {action:"avatar"} -> saves the cropped profile photo
export async function POST(req: Request) {
  const parsed = Avatar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { slug, dataUrl } = parsed.data;

  const session = await authorizeOwner(req, slug);
  if (!session) return Response.json({ error: "Please sign in as the owner of this business." }, { status: 401 });
  if (!rateLimit(`avatar:${clientIp(req)}`, 10, 10 * 60_000)) return Response.json({ error: "Too many uploads." }, { status: 429 });

  const url = await uploadImage(dataUrl, "avatars");
  if (!url) return Response.json({ error: "Please use a JPG, PNG or WebP image under 700 KB." }, { status: 400 });
  await setAvatar(slug, url);
  return Response.json({ avatarUrl: url });
}
