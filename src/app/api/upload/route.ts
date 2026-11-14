import { verifyToken } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { uploadImage } from "@/lib/store";

// Product photo upload for the interview studio (requires a valid ambassador token).
export async function POST(req: Request) {
  if (!verifyToken(req.headers.get("x-ambassador-token"))) {
    return Response.json({ error: "Please sign in as a Tech Ambassador first." }, { status: 401 });
  }
  if (!rateLimit(`upload:${clientIp(req)}`, 30, 10 * 60_000)) {
    return Response.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { dataUrl?: string } | null;
  const url = body?.dataUrl ? await uploadImage(body.dataUrl, "photos") : null;
  if (!url) return Response.json({ error: "Please upload a JPG, PNG or WebP image under 700 KB." }, { status: 400 });
  return Response.json({ url });
}
