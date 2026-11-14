// Languages supported for interviews and bilingual sites.
// To add a language, add one line here — nothing else needs to change.
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "zh", label: "Mandarin Chinese", native: "中文" },
  { code: "tl", label: "Tagalog", native: "Tagalog" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export function getLanguage(code: string) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
