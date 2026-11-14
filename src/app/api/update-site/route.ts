import type { Part } from "@google/genai";
import { z } from "zod";
import { AiConfigError, SAFETY_RULES, generateJson } from "@/lib/gemini";
import { canMock } from "@/lib/mock";
import { authorizeOwner } from "@/lib/owner";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { SiteContentSchema, normalizeContent } from "@/lib/schemas";
import { getBusiness, updateContent } from "@/lib/store";

export const maxDuration = 60;

const Body = z.object({
  slug: z.string().min(1).max(80),
  instruction: z.string().max(600).optional(),
  audio: z.object({ data: z.string().max(600_000), mimeType: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i) }).optional(),
});

const Result = z.object({
  content: SiteContentSchema,
  changeSummary: z.string().describe("One friendly sentence describing exactly what changed"),
});

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.instruction?.trim() && !parsed.data.audio)) {
    return bad("Type or record what you'd like to change.");
  }
  const { slug, instruction, audio } = parsed.data;

  const session = await authorizeOwner(req, slug);
  if (!session) return bad("Please sign in as the owner of this business.", 401);
  if (!rateLimit(`upd:${clientIp(req)}`, 15, 10 * 60_000)) return bad("Too many updates. Please wait a few minutes.", 429);

  const business = await getBusiness(slug);
  if (!business) return bad("Business not found.", 404);

  try {
    let result: z.infer<typeof Result>;
    if (canMock()) {
      result = {
        content: {
          ...business.content,
          announcement: { en: instruction ?? "Updated", alt: `[alt] ${instruction ?? "Updated"}` },
        },
        changeSummary: "Added your notice (dev mock).",
      };
    } else {
      const parts: Part[] = [
        { text: `Current website JSON:\n${JSON.stringify(business.content)}` },
        { text: `The owner's second language is ${business.altLang.label}. The owner's requested change:` },
      ];
      if (instruction?.trim()) parts.push({ text: instruction.trim() });
      if (audio) parts.push({ inlineData: { data: audio.data, mimeType: audio.mimeType.split(";")[0] } });

      result = await generateJson({
        system: `You edit a small-business website. You receive the current website JSON and the owner's requested change (typed or spoken, any language).
Return the COMPLETE updated website JSON plus a one-sentence changeSummary.
- Apply ONLY what the owner asked for; keep everything else exactly as it was.
- Keep every text field bilingual: "en" in English and "alt" in ${business.altLang.label}${business.altLang.code === "en" ? " (identical to en)" : ""}.
- Short-term news ("sold out", "closed Monday", "new item") goes in "announcement" and/or the relevant service. Remove sold-out items only if asked; otherwise mention "sold out" in the announcement.
- New items need an emoji and a price exactly as the owner said (or "Ask for a quote").
${SAFETY_RULES}`,
        parts,
        schema: Result,
        temperature: 0.2,
      });
    }

    const content = normalizeContent(result.content);
    await updateContent(slug, content);
    return Response.json({ content, changeSummary: result.changeSummary.slice(0, 240) });
  } catch (e) {
    if (e instanceof AiConfigError) return bad(e.message, 503);
    console.error("update-site failed", e);
    return bad("Couldn't apply that update. Please try rephrasing and try again.", 502);
  }
}
