import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed tokens for Tech Ambassadors, so the app works even
 * without a database (judge demo mode) and tokens can't be forged client-side.
 */
function secret(): string {
  return (
    process.env.APP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GEMINI_API_KEY ||
    "dev-only-insecure-secret" // fine for local demos; set APP_SECRET in production
  );
}

export interface AmbassadorClaims {
  id: string;
  name: string;
  email: string;
  demo: boolean;
  exp: number; // unix ms
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signToken(claims: AmbassadorClaims): string {
  const payload = b64(JSON.stringify(claims));
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | null | undefined): AmbassadorClaims | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as AmbassadorClaims;
    return claims.exp > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

/** The school domain student accounts must use (demo toggle bypasses this for judges). */
export const SCHOOL_DOMAIN = "lammersvilleusd.net";

export function isSchoolEmail(email: string): boolean {
  return new RegExp(`^[^@\\s]+@${SCHOOL_DOMAIN.replace(".", "\\.")}$`, "i").test(email.trim());
}

/** Passcodes let an ambassador sign back in (the school email alone is not verified). */
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(passcode, salt, 32).toString("hex")}`;
}

export function checkPasscode(passcode: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(passcode, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
