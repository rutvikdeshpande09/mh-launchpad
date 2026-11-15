// Languages supported for interviews and bilingual sites, chosen for the communities in and around
// Mountain House. To add one, add a line here and its page labels in ui-strings.ts; nothing else changes.
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "zh", label: "Mandarin Chinese", native: "中文" },
  { code: "tl", label: "Tagalog", native: "Tagalog" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "ko", label: "Korean", native: "한국어" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

/** Languages written right to left. */
export const RTL_LANGUAGES: readonly string[] = ["ur"];

export function getLanguage(code: string) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
