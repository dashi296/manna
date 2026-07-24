export const LANGUAGES = {
  ja: { apiCode: 'jpn', label: '日本語' },
  en: { apiCode: 'eng', label: 'English' },
}

export function resolveLanguage(code) {
  const entry = LANGUAGES[code]
  if (!entry) {
    throw new Error(`Unknown language code: ${code}. Add it to LANGUAGES in scripts/lib/languages.mjs first.`)
  }
  return { code, ...entry }
}
