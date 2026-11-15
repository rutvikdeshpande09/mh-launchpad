import { verifyToken } from "@/lib/auth";
import { authorizeOwnerAccount } from "@/lib/owner";
import { signDraftToken } from "@/lib/preview";
import type { Business } from "@/lib/schemas";
import { listBusinessesForOwner, listCreationsForAmbassador } from "@/lib/store";

const item = (b: Business) => ({
  slug: b.slug,
  name: b.content.businessName,
  category: b.content.category,
  emoji: b.content.theme.emoji,
  primary: b.content.theme.primary,
  accent: b.content.theme.accent,
  published: b.published,
  isDemo: b.isDemo,
  createdAt: b.createdAt,
  // Lets the signed-in person preview and edit a draft that is not public yet.
  draftToken: signDraftToken(b.slug),
});

/**
 * Everything the signed-in person has created: sites they interviewed for (as an
 * ambassador) and sites they own (as a business owner). Either or both may apply.
 */
export async function GET(req: Request) {
  const ambassador = verifyToken(req.headers.get("x-ambassador-token"));
  const owner = await authorizeOwnerAccount(req);
  if (!ambassador && !owner) return Response.json({ error: "Please sign in first." }, { status: 401 });

  const [made, owned] = await Promise.all([
    ambassador ? listCreationsForAmbassador(ambassador.id) : Promise.resolve([]),
    owner ? listBusinessesForOwner(owner.email) : Promise.resolve([]),
  ]);
  return Response.json({ asAmbassador: made.map(item), asOwner: owned.map(item) });
}
