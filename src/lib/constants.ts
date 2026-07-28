/* ────────────────────────────────────────────────────────────
   Shared reference data used across registration, profile, and
   admin settings forms.
   ──────────────────────────────────────────────────────────── */

/** Language codes supported site-wide.
 *  English/French remain fully translated; other languages are
 *  stored as the learner's communication preference and used for
 *  correspondence/support routing — UI strings still fall back to
 *  English/French until those locales are translated.
 */
export const LANGUAGES: { code: string; en: string; fr: string }[] = [
  { code: "en", en: "English",    fr: "Anglais" },
  { code: "fr", en: "French",     fr: "Français" },
  { code: "es", en: "Spanish",    fr: "Espagnol" },
  { code: "pt", en: "Portuguese", fr: "Portugais" },
  { code: "ar", en: "Arabic",     fr: "Arabe" },
  { code: "sw", en: "Swahili",    fr: "Swahili" },
  { code: "ha", en: "Hausa",      fr: "Haoussa" },
  { code: "yo", en: "Yoruba",     fr: "Yorouba" },
  { code: "ig", en: "Igbo",       fr: "Igbo" },
  { code: "zh", en: "Chinese",    fr: "Chinois" },
];

/** Countries / nationalities offered at registration.
 *  A global list — LWGSM serves students worldwide, not one region.
 */
export const COUNTRIES: string[] = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "Cameroon", "Benin", "Côte d'Ivoire", "Togo", "Senegal",
  "Egypt", "Ethiopia", "Uganda", "Tanzania", "Zambia", "Zimbabwe", "Rwanda", "Sierra Leone", "Liberia",
  "United States", "Canada", "United Kingdom", "Ireland", "France", "Belgium", "Germany", "Netherlands",
  "Spain", "Portugal", "Italy", "Switzerland", "Sweden", "Norway", "Australia", "New Zealand",
  "India", "Philippines", "China", "Japan", "South Korea", "Singapore", "Malaysia", "Indonesia",
  "United Arab Emirates", "Saudi Arabia", "Israel",
  "Brazil", "Mexico", "Jamaica", "Trinidad and Tobago", "Haiti",
  "Other",
];

/** ISO 3166-1 alpha-2 codes for the COUNTRIES list above — used to build
 *  each student's international matric number (e.g. Nigeria -> NG). */
export const COUNTRY_CODES: Record<string, string> = {
  "Nigeria": "NG", "Ghana": "GH", "Kenya": "KE", "South Africa": "ZA", "Cameroon": "CM",
  "Benin": "BJ", "Côte d'Ivoire": "CI", "Togo": "TG", "Senegal": "SN",
  "Egypt": "EG", "Ethiopia": "ET", "Uganda": "UG", "Tanzania": "TZ", "Zambia": "ZM",
  "Zimbabwe": "ZW", "Rwanda": "RW", "Sierra Leone": "SL", "Liberia": "LR",
  "United States": "US", "Canada": "CA", "United Kingdom": "GB", "Ireland": "IE",
  "France": "FR", "Belgium": "BE", "Germany": "DE", "Netherlands": "NL",
  "Spain": "ES", "Portugal": "PT", "Italy": "IT", "Switzerland": "CH", "Sweden": "SE",
  "Norway": "NO", "Australia": "AU", "New Zealand": "NZ",
  "India": "IN", "Philippines": "PH", "China": "CN", "Japan": "JP", "South Korea": "KR",
  "Singapore": "SG", "Malaysia": "MY", "Indonesia": "ID",
  "United Arab Emirates": "AE", "Saudi Arabia": "SA", "Israel": "IL",
  "Brazil": "BR", "Mexico": "MX", "Jamaica": "JM", "Trinidad and Tobago": "TT", "Haiti": "HT",
  "Other": "XX",
};

/** International calling codes for the COUNTRIES list above — used to
 *  prefix the phone number field so numbers are stored in a consistent,
 *  unambiguous format (e.g. +234 801 234 5678) instead of whatever the
 *  applicant happened to type. */
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  "Nigeria": "+234", "Ghana": "+233", "Kenya": "+254", "South Africa": "+27", "Cameroon": "+237",
  "Benin": "+229", "Côte d'Ivoire": "+225", "Togo": "+228", "Senegal": "+221",
  "Egypt": "+20", "Ethiopia": "+251", "Uganda": "+256", "Tanzania": "+255", "Zambia": "+260",
  "Zimbabwe": "+263", "Rwanda": "+250", "Sierra Leone": "+232", "Liberia": "+231",
  "United States": "+1", "Canada": "+1", "United Kingdom": "+44", "Ireland": "+353",
  "France": "+33", "Belgium": "+32", "Germany": "+49", "Netherlands": "+31",
  "Spain": "+34", "Portugal": "+351", "Italy": "+39", "Switzerland": "+41", "Sweden": "+46",
  "Norway": "+47", "Australia": "+61", "New Zealand": "+64",
  "India": "+91", "Philippines": "+63", "China": "+86", "Japan": "+81", "South Korea": "+82",
  "Singapore": "+65", "Malaysia": "+60", "Indonesia": "+62",
  "United Arab Emirates": "+971", "Saudi Arabia": "+966", "Israel": "+972",
  "Brazil": "+55", "Mexico": "+52", "Jamaica": "+1", "Trinidad and Tobago": "+1", "Haiti": "+509",
  "Other": "",
};

export const CURRENCIES = [
  { code: "EUR", symbol: "€",  en: "Euro",             fr: "Euro" },
  { code: "USD", symbol: "$",  en: "US Dollar", fr: "Dollar Américain" },
  { code: "NGN", symbol: "₦", en: "Nigerian Naira", fr: "Naira Nigérian" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

/** Payment types offered on /student/payments. "fixed" types pre-fill (and
 *  lock) the amount field from site_settings; "variable" types (tuition,
 *  premium material, other charges) leave the amount editable. */
export const PAYMENT_TYPES: {
  value: "registration" | "tuition" | "certificate" | "material" | "other";
  en: string;
  fr: string;
  kind: "fixed" | "variable";
  feeSettingKey?: string;
}[] = [
  { value: "registration", en: "Registration Fee",          fr: "Frais d'Inscription",        kind: "fixed",    feeSettingKey: "fee_registration" },
  { value: "tuition",      en: "Tuition Fee",                fr: "Frais de Scolarité",          kind: "variable" },
  { value: "certificate",  en: "Certificate Collection Fee",  fr: "Frais de Retrait de Certificat", kind: "fixed", feeSettingKey: "fee_certificate" },
  { value: "material",     en: "Premium Course Material",     fr: "Matériel de Cours Premium",   kind: "variable" },
  { value: "other",        en: "Other Charges",               fr: "Autres Frais",                kind: "variable" },
];