import type { SiteContent } from "./schemas";

/**
 * DEV-ONLY stand-ins used when no GEMINI_API_KEY is set and NODE_ENV !== "production",
 * so the full flow can be exercised locally. Never active in production builds.
 */
export const canMock = () => !process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "production";

export function mockSite(name: string, answers: string[]): SiteContent {
  const bi = (s: string) => ({ en: s, alt: `[alt] ${s}` });
  return {
    businessName: name || "Mock Business",
    category: "Home business",
    tagline: bi("Local, handmade, and made with care"),
    about: bi(answers[1] || "A small home business serving the Mountain House community."),
    services: [{ name: bi("Signature item"), description: bi(answers[2] || "Ask for details"), price: "Ask for a quote", emoji: "✨" }],
    highlights: [bi("Made to order"), bi("Local to Mountain House")],
    hours: bi("Ask for details"),
    serviceArea: "Mountain House, CA",
    announcement: bi(""),
    theme: { primary: "#7c3aed", accent: "#0891b2", emoji: "✨" },
    cardTagline: "Local, handmade, made with care",
  };
}
