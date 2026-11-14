import "server-only";
import { admin, getBusiness, isOwner, usingSupabase } from "./store";

export interface OwnerSession {
  email: string;
  demo: boolean;
}

/**
 * Decide whether a request may manage a business.
 *  - Real owners: Supabase magic-link session (Bearer access token) whose email
 *    matches the business owner.
 *  - Demo access for judges: allowed only for the seeded demo businesses, or for
 *    any business when Supabase isn't configured (local/zero-setup mode).
 */
export async function authorizeOwner(req: Request, slug: string): Promise<OwnerSession | null> {
  const business = await getBusiness(slug);
  if (!business) return null;

  if (req.headers.get("x-demo-owner") === "1" && (business.isDemo || !usingSupabase)) {
    return { email: "demo-owner", demo: true };
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && usingSupabase) {
    const { data } = await admin().auth.getUser(bearer);
    const email = data.user?.email;
    if (email && (await isOwner(slug, email))) return { email, demo: false };
  }
  return null;
}

/**
 * Who is this business owner, before they have a site? Real owners sign in with a Supabase
 * magic link; judges can use demo access, which is kept fully separate from real data.
 */
export async function authorizeOwnerAccount(req: Request): Promise<OwnerSession | null> {
  if (req.headers.get("x-demo-owner") === "1") return { email: "demo-owner@demo.local", demo: true };
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && usingSupabase) {
    const { data } = await admin().auth.getUser(bearer);
    if (data.user?.email) return { email: data.user.email.toLowerCase(), demo: false };
  }
  return null;
}
