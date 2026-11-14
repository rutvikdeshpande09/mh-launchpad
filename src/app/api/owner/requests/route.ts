import { z } from "zod";
import { LANGUAGES } from "@/lib/languages";
import { authorizeOwnerAccount } from "@/lib/owner";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { publicRequest } from "@/lib/schemas";
import { createRequest, getAmbassador, listRequestsForOwner } from "@/lib/store";

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
const langCodes = LANGUAGES.map((l) => l.code) as [string, ...string[]];

const Body = z.object({
  businessName: z.string().trim().min(2).max(80),
  ownerLanguage: z.enum(langCodes),
  note: z.string().trim().max(400),
  contact: z.string().trim().max(120),
  ambassadorId: z.string().min(1).max(64),
});

/** My requests (the signed-in owner's own). */
export async function GET(req: Request) {
  const session = await authorizeOwnerAccount(req);
  if (!session) return bad("Please sign in as a business owner.", 401);
  const requests = await listRequestsForOwner(session.email);
  return Response.json({ requests: requests.map(publicRequest), email: session.demo ? null : session.email });
}

/** Ask a specific ambassador to interview me. */
export async function POST(req: Request) {
  const session = await authorizeOwnerAccount(req);
  if (!session) return bad("Please sign in as a business owner.", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Please enter your business name, pick a language, and choose an ambassador.");
  const b = parsed.data;

  if (!rateLimit(`req:${clientIp(req)}`, 10, 60 * 60_000) || !rateLimit(`req:${session.email}`, 5, 60 * 60_000)) {
    return bad("You've sent several requests recently. Please wait a bit before sending another.", 429);
  }

  const ambassador = await getAmbassador(b.ambassadorId);
  if (!ambassador || !ambassador.accepting) return bad("That ambassador isn't accepting requests right now. Please choose another.", 404);
  // Demo and real accounts never mix, so judges can't message real students (and vice versa).
  if (ambassador.demo !== session.demo) return bad("That ambassador isn't available to you.", 403);

  const pending = (await listRequestsForOwner(session.email)).filter((r) => r.status === "pending").length;
  if (pending >= 3) return bad("You already have 3 requests waiting for an answer. Please wait for a reply first.", 429);

  const request = await createRequest({
    ambassadorId: ambassador.id,
    ambassadorName: ambassador.name,
    ownerEmail: session.email,
    businessName: b.businessName,
    ownerLanguage: b.ownerLanguage,
    note: b.note,
    contact: b.contact,
    isDemo: session.demo,
  });
  return Response.json({ request: publicRequest(request) });
}
