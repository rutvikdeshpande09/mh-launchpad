import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { addInquiry, getBusiness } from "@/lib/store";

const Body = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(60),
  contact: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(800),
  website: z.string().optional(), // honeypot: real people leave this empty
});

// "Masked" inquiry: visitors never see the owner's email or phone. Messages are
// stored and shown only to the owner inside their private portal.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please fill in your name, how to reach you, and a short message." }, { status: 400 });
  const { slug, name, contact, message, website } = parsed.data;

  if (website) return Response.json({ ok: true }); // silently drop bots
  if (!rateLimit(`inq:${clientIp(req)}`, 5, 10 * 60_000)) {
    return Response.json({ error: "Too many messages. Please try again in a few minutes." }, { status: 429 });
  }
  if (!(await getBusiness(slug))) return Response.json({ error: "Business not found." }, { status: 404 });

  await addInquiry(slug, { name, contact, message });
  return Response.json({ ok: true });
}
