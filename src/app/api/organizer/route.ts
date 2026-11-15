import { z } from "zod";
import { authorizeOrganizer, signedInEmail } from "@/lib/owner";
import { signDraftToken } from "@/lib/preview";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { Business } from "@/lib/schemas";
import { deleteBusiness, getBusiness, listAllBusinesses, setListed, setPublished, setSortOrders } from "@/lib/store";

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Gate: must be signed in AND listed in the organizers table. */
async function gate(req: Request): Promise<Response | null> {
  if (await authorizeOrganizer(req)) return null;
  return (await signedInEmail(req))
    ? bad("This account isn't a website organizer.", 403)
    : bad("Please sign in as a website organizer.", 401);
}

const item = (b: Business) => ({
  slug: b.slug,
  name: b.content.businessName,
  category: b.content.category,
  emoji: b.content.theme.emoji,
  primary: b.content.theme.primary,
  accent: b.content.theme.accent,
  published: b.published,
  listed: b.listed,
  isDemo: b.isDemo,
  createdAt: b.createdAt,
  ambassadorName: b.ambassadorName,
  sortOrder: b.sortOrder,
  draftToken: signDraftToken(b.slug), // lets the organizer preview and edit unpublished sites
});

/** Every site, published or not. */
export async function GET(req: Request) {
  const denied = await gate(req);
  if (denied) return denied;
  return Response.json({ sites: (await listAllBusinesses()).map(item) });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reorder"), slugs: z.array(z.string().min(1).max(80)).min(1).max(200) }),
  z.object({ action: z.literal("publish"), slug: z.string().min(1).max(80), published: z.boolean() }),
  z.object({ action: z.literal("listing"), slug: z.string().min(1).max(80), listed: z.boolean() }),
  z.object({ action: z.literal("delete"), slug: z.string().min(1).max(80) }),
]);

export async function POST(req: Request) {
  const denied = await gate(req);
  if (denied) return denied;
  if (!rateLimit(`org:${clientIp(req)}`, 120, 10 * 60_000)) return bad("Too many changes. Please wait a few minutes.", 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid request.");
  const body = parsed.data;

  if (body.action === "reorder") {
    const all = await listAllBusinesses();
    const published = new Set(all.filter((b) => b.published).map((b) => b.slug));
    const slugs = [...new Set(body.slugs)].filter((s) => published.has(s));
    if (slugs.length === 0) return bad("Nothing to reorder.");
    // Any published site not mentioned keeps its place after the listed ones.
    const ok = await setSortOrders(slugs);
    return ok ? Response.json({ ok: true }) : bad("Couldn't save the order. The database update for ordering may not have been run yet.", 500);
  }

  const business = await getBusiness(body.slug);
  if (!business) return bad("Site not found.", 404);

  if (body.action === "publish") {
    const ok = await setPublished(body.slug, body.published);
    return ok ? Response.json({ published: body.published }) : bad("Couldn't save.", 500);
  }

  if (body.action === "listing") {
    const ok = await setListed(body.slug, body.listed);
    return ok ? Response.json({ listed: body.listed }) : bad("Couldn't save. The database update for listing may not have been run yet.", 500);
  }

  // delete: only sites that are already hidden or still drafts, so a live site is never removed by one click
  if (business.published) return bad("Hide this site first, then delete it.", 409);
  const ok = await deleteBusiness(body.slug);
  return ok ? Response.json({ deleted: true }) : bad("Couldn't delete.", 500);
}
