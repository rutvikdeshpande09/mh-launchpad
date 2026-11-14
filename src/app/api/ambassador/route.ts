import { z } from "zod";
import { checkPasscode, signToken, verifyToken } from "@/lib/auth";
import { LANGUAGES } from "@/lib/languages";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { publicRequest } from "@/lib/schemas";
import {
  getAmbassador,
  getAmbassadorByEmail,
  getRequest,
  listRequestsForAmbassador,
  updateAmbassadorProfile,
  updateRequest,
} from "@/lib/store";

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
const langCodes = LANGUAGES.map((l) => l.code) as [string, ...string[]];

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signin"), email: z.string().max(120), passcode: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("profile"),
    languages: z.array(z.enum(langCodes)).min(1).max(7),
    bio: z.string().trim().max(160),
    accepting: z.boolean(),
  }),
  z.object({ action: z.literal("respond"), requestId: z.string().min(1).max(64), decision: z.enum(["accept", "decline"]) }),
]);

/** My profile + my interview requests. Requires the ambassador token. */
export async function GET(req: Request) {
  const claims = verifyToken(req.headers.get("x-ambassador-token"));
  if (!claims) return bad("Please sign in as a Tech Ambassador.", 401);
  const profile = await getAmbassador(claims.id);
  const requests = await listRequestsForAmbassador(claims.id);
  return Response.json({
    profile: profile
      ? { id: profile.id, name: profile.name, languages: profile.languages, bio: profile.bio, accepting: profile.accepting, demo: profile.demo }
      : { id: claims.id, name: claims.name, languages: [], bio: "", accepting: false, demo: claims.demo },
    // The owner's login email is never shown to the ambassador; only what the owner chose to share.
    requests: requests.map(publicRequest),
  });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid request.");
  const body = parsed.data;

  // ---- sign back in with email + passcode ----
  if (body.action === "signin") {
    const email = body.email.trim().toLowerCase();
    if (!rateLimit(`signin:${clientIp(req)}`, 10, 10 * 60_000) || !rateLimit(`signin:${email}`, 6, 10 * 60_000)) {
      return bad("Too many attempts. Please wait a few minutes.", 429);
    }
    const amb = await getAmbassadorByEmail(email);
    if (!amb || !checkPasscode(body.passcode, amb.passcodeHash)) return bad("That email and passcode don't match an ambassador account.", 401);
    const claims = { id: amb.id, name: amb.name, email, demo: false, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 };
    return Response.json({ token: signToken(claims), ambassador: { id: amb.id, name: amb.name, demo: false } });
  }

  // ---- everything else needs the token ----
  const claims = verifyToken(req.headers.get("x-ambassador-token"));
  if (!claims) return bad("Please sign in as a Tech Ambassador.", 401);

  if (body.action === "profile") {
    const ok = await updateAmbassadorProfile(claims.id, { languages: body.languages, bio: body.bio, accepting: body.accepting });
    if (!ok) return bad("Couldn't save your profile. If this keeps happening, the database update may not have been run.", 500);
    return Response.json({ ok: true });
  }

  // respond to a request
  const request = await getRequest(body.requestId);
  if (!request || request.ambassadorId !== claims.id) return bad("Request not found.", 404);
  if (request.status !== "pending") return bad("That request has already been answered.", 409);
  await updateRequest(request.id, { status: body.decision === "accept" ? "accepted" : "declined" });
  return Response.json({ status: body.decision === "accept" ? "accepted" : "declined" });
}
