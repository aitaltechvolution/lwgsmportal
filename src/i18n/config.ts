import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import fr from "./fr.json";
import { LANGUAGES } from "@/lib/constants";

// LANGUAGES (src/lib/constants.ts) is the single source of truth for every
// language code the app accepts anywhere (registration, profile
// preference, this i18next instance). English and French are the only
// languages with real translation bundles today; every other code is
// registered here pointing at the English bundle so:
//   - i18next never logs "missing language" warnings for them
//   - i18n.changeLanguage('sw') etc. succeeds instead of silently no-op'ing
//   - adding a real translation later is just swapping `en` for a new
//     import on that one line — no other code changes needed
// UI strings outside this file (the bulk of the app) use a local
// `lang === "fr" ? frText : enText` pattern rather than t() keys; for any
// language code that isn't "fr" exactly, that pattern already reads as
// English, which is the intended graceful fallback.
const resources = LANGUAGES.reduce<Record<string, { translation: typeof en }>>((acc, l) => {
  acc[l.code] = { translation: l.code === "fr" ? fr : en };
  return acc;
}, {});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "lwgsm_lang",
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
