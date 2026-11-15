import { z } from "zod";
import { authorizeOrganizer, authorizeOwner } from "@/lib/owner";
import { verifyDraftToken } from "@/lib/preview";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { getBusiness, setListed, setPublished } from "@/lib/store";

const Body = z.object({ slug: z.string().min(1).max(80), published: z.boolean(), listed: z.boolean().optional() });

// Publish or hide a site. Allowed for the signed-in owner, or for whoever holds the
// private draft link (x-draft-token), so an ambassador/owner can approve a draft.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { slug, published, listed } = parsed.data;

  if (!rateLimit(`pub:${clientIp(req)}`, 20, 10 * 60_000)) {
    return Response.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  }
  const business = await getBusiness(slug);
  if (!business) return Response.json({ error: "Business not found." }, { status: 404 });

  const byDraftLink = verifyDraftToken(req.headers.get("x-draft-token"), slug);
  const byOwner = byDraftLink ? null : (await authorizeOwner(req, slug)) ?? (await authorizeOrganizer(req));
  if (!byDraftLink && !byOwner) {
    return Response.json({ error: "Please sign in as the owner, or use the private draft link." }, { status: 401 });
  }

  // Set the listing choice first: if it can't be saved we stop, so a site never appears on the homepage by accident.
  if (listed !== undefined && !(await setListed(slug, listed))) {
    return Response.json({ error: "Couldn't save the listing choice. The database update in supabase/schema.sql may not have been run yet." }, { status: 500 });
  }
  const ok = await setPublished(slug, published);
  if (!ok) {
    return Response.json(
      { error: "Couldn't save. The database update in supabase/schema.sql may not have been run yet." },
      { status: 500 },
    );
  }
  return Response.json({ published, ...(listed !== undefined ? { listed } : {}) });
}
