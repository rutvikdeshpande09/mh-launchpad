import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AiConfigError, SAFETY_RULES, generateJson } from "@/lib/gemini";
import { SCENARIO } from "@/lib/content";
import { canMock } from "@/lib/mock";
import { isSchoolEmail, signToken } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { recordAmbassador } from "@/lib/store";

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("followup"), rewrite: z.string().min(1).max(1200) }),
  z.object({
    action: z.literal("grade"),
    rewrite: z.string().min(1).max(1200),
    question: z.string().min(1).max(400),
    answer: z.string().min(1).max(800),
    name: z.string().min(2).max(60),
    email: z.string().max(120),
  }),
  z.object({ action: z.literal("demo"), name: z.string().min(2).max(60).optional() }),
]);

const FollowUp = z.object({ question: z.string().describe("One short follow-up question, one sentence") });
const Grade = z.object({
  passed: z.boolean(),
  score: z.number().describe("0 to 10"),
  feedback: z.string().describe("Two encouraging sentences with one concrete tip"),
});

/** "Maya Patel" -> "Maya P." so full surnames of minors never appear publicly. */
function displayName(full: string): string {
  const [first, ...rest] = full.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

function issue(name: string, email: string, demo: boolean) {
  const claims = { id: randomUUID(), name: displayName(name), email, demo, exp: Date.now() + 1000 * 60 * 60 * 24 * 3 };
  return { token: signToken(claims), ambassador: { id: claims.id, name: claims.name, demo } };
}

export async function POST(req: Request) {
  if (!rateLimit(`grade:${clientIp(req)}`, 20, 10 * 60_000)) return bad("Too many attempts. Please wait a few minutes.", 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid request.");
  const body = parsed.data;

  // Judge shortcut: skips email + skill check; certificates are labelled as demo.
  if (body.action === "demo") {
    const { token, ambassador } = issue(body.name || "Judge Demo", "judge@demo.local", true);
    await recordAmbassador({ id: ambassador.id, name: ambassador.name, email: "judge@demo.local", demo: true });
    return Response.json({ passed: true, token, ambassador, feedback: "Demo access granted." });
  }

  try {
    if (body.action === "followup") {
      if (canMock()) return Response.json({ question: "Who is your ideal customer, and why would they choose you?" });
      const { question } = await generateJson({
        system: `You are a friendly mentor for a student volunteer program. ${SAFETY_RULES}`,
        parts: [
          {
            text: `A student rewrote a messy home-business description for a website.\nOriginal: ${SCENARIO}\nStudent rewrite: ${body.rewrite}\n\nAsk ONE short follow-up question (a single sentence) about a specific choice they made in THEIR rewrite, so we can tell they wrote it themselves.`,
          },
        ],
        schema: FollowUp,
        temperature: 0.7,
      });
      return Response.json({ question });
    }

    // action === "grade"
    if (!isSchoolEmail(body.email)) return bad("Please use your @lammersvilleusd.net school email, or use the judge demo option.");
    if (body.rewrite.trim().toLowerCase() === SCENARIO.toLowerCase()) return bad("Your rewrite is the same as the original. Try improving it!");

    const result = canMock()
      ? { passed: body.rewrite.length > 40 && body.answer.length > 10, score: 8, feedback: "Great start! (dev mock grading)" }
      : await generateJson({
          system: `You grade a short skills check for high-school volunteers. Be fair and encouraging. ${SAFETY_RULES}`,
          parts: [
            {
              text: `Task given to the student: rewrite the description below into 2-3 clear, friendly, professional sentences for a customer-facing website, then answer a follow-up question.

Original: ${SCENARIO}

Student rewrite: ${body.rewrite}
Follow-up question: ${body.question}
Student answer: ${body.answer}

Pass (passed=true, score >= 6) only if: the rewrite is clearer, polite and professional; it keeps the real facts (home cakes, birthdays, order by text, chocolate or vanilla) without inventing new ones; and the answer is a genuine, consistent explanation of their own rewrite (not a vague or generic reply).`,
            },
          ],
          schema: Grade,
          temperature: 0.2,
        });

    if (!result.passed) return Response.json({ passed: false, score: result.score, feedback: result.feedback });

    const { token, ambassador } = issue(body.name, body.email.trim().toLowerCase(), false);
    await recordAmbassador({ id: ambassador.id, name: ambassador.name, email: body.email.trim().toLowerCase(), demo: false });
    return Response.json({ passed: true, score: result.score, feedback: result.feedback, token, ambassador });
  } catch (e) {
    if (e instanceof AiConfigError) return bad(e.message, 503);
    console.error("grade-skill failed", e);
    return bad("The AI check failed. Please try again.", 502);
  }
}
