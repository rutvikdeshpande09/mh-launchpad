import "server-only";
import { signToken, verifyToken } from "./auth";

/**
 * A private "draft link" for one business. Whoever holds it can preview the unpublished
 * site and publish it (the ambassador shares it with the owner on the call).
 */
export function signDraftToken(slug: string): string {
  return signToken({ id: `draft:${slug}`, name: "draft", email: "", demo: false, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 });
}

export function verifyDraftToken(token: string | null | undefined, slug: string): boolean {
  return verifyToken(token)?.id === `draft:${slug}`;
}
