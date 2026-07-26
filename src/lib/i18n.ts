// Lightweight, dependency-free i18n for the worker-facing surfaces.
// The UI is designed icons-first — these strings are reinforcement for those
// who can read, in whichever language they know. No "server-only": both
// server and client components call t(); reading the cookie lives in
// i18nServer.ts (server) and the switcher writes it client-side.

export type Lang = "en" | "hi" | "te";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "te", label: "తెలుగు" },
];

export const LANG_COOKIE = "lang";

type Entry = Record<Lang, string>;

const dict = {
  // Navigation / shell
  home: { en: "Home", hi: "होम", te: "హోమ్" },
  search: { en: "Search", hi: "खोजें", te: "వెతకండి" },
  back: { en: "Back", hi: "वापस", te: "వెనక్కి" },
  signOut: { en: "Sign out", hi: "लॉगआउट", te: "లాగ్ అవుట్" },
  language: { en: "Language", hi: "भाषा", te: "భాష" },

  // Login
  signIn: { en: "Sign in", hi: "लॉगिन", te: "లాగిన్" },
  email: { en: "Email", hi: "ईमेल", te: "ఇమెయిల్" },
  password: { en: "Password", hi: "पासवर्ड", te: "పాస్‌వర్డ్" },

  // Worker home
  findBlock: { en: "Find a block", hi: "ब्लॉक खोजें", te: "బ్లాక్ వెతకండి" },
  newBlock: { en: "New block", hi: "नया ब्लॉक", te: "కొత్త బ్లాక్" },
  needPhotos: { en: "Need photos", hi: "फोटो चाहिए", te: "ఫోటోలు కావాలి" },
  searchPlaceholder: { en: "Block number…", hi: "ब्लॉक नंबर…", te: "బ్లాక్ నంబర్…" },
  noResults: { en: "No blocks found", hi: "कोई ब्लॉक नहीं मिला", te: "బ్లాక్స్ కనబడలేదు" },

  // Block detail / actions
  addPhoto: { en: "Add photo", hi: "फोटो जोड़ें", te: "ఫోటో జోడించండి" },
  takePhoto: { en: "Take photo", hi: "फोटो लें", te: "ఫోటో తీయండి" },
  photos: { en: "Photos", hi: "फोटो", te: "ఫోటోలు" },
  changeStatus: { en: "Change status", hi: "स्थिति बदलें", te: "స్టేటస్ మార్చండి" },
  save: { en: "Save", hi: "सेव करें", te: "సేవ్ చేయండి" },
  cancel: { en: "Cancel", hi: "रद्द करें", te: "రద్దు" },
  saved: { en: "Saved ✓", hi: "सेव हो गया ✓", te: "సేవ్ అయింది ✓" },
  photoAdded: { en: "Photo added ✓", hi: "फोटो जुड़ गया ✓", te: "ఫోటో జోడించబడింది ✓" },
  edit: { en: "Edit", hi: "बदलें", te: "మార్చండి" },

  // Block fields
  blockNo: { en: "Block number", hi: "ब्लॉक नंबर", te: "బ్లాక్ నంబర్" },
  colour: { en: "Colour", hi: "रंग", te: "రంగు" },
  weightTons: { en: "Weight (tons)", hi: "वज़न (टन)", te: "బరువు (టన్నులు)" },
  lengthCm: { en: "Length (cm)", hi: "लंबाई (सेमी)", te: "పొడవు (సెం.మీ)" },
  heightCm: { en: "Height (cm)", hi: "ऊंचाई (सेमी)", te: "ఎత్తు (సెం.మీ)" },
  thicknessMm: { en: "Thickness (mm)", hi: "मोटाई (मिमी)", te: "మందం (మి.మీ)" },
  slabs: { en: "No. of slabs", hi: "स्लैब की संख्या", te: "పలకల సంఖ్య" },
  totalSft: { en: "Total SFT", hi: "कुल SFT", te: "మొత్తం SFT" },

  // Status change reasons (tappable presets — stored in English in the audit
  // log so management reports stay consistent; see WORKER_REASONS below)
  whyQuestion: { en: "Why?", hi: "क्यों?", te: "ఎందుకు?" },

  // Statuses
  status_NEEDS_PHOTOS: { en: "Needs photos", hi: "फोटो चाहिए", te: "ఫోటోలు కావాలి" },
  status_IN_STOCK: { en: "In stock", hi: "स्टॉक में है", te: "స్టాక్‌లో ఉంది" },
  status_READY_TO_DISPATCH: { en: "Ready to dispatch", hi: "भेजने के लिए तैयार", te: "పంపడానికి సిద్ధం" },
  status_HOLD: { en: "Hold", hi: "होल्ड", te: "హోల్డ్" },
  status_PARTIALLY_SOLD: { en: "Partially sold", hi: "कुछ बिका", te: "కొంత అమ్మింది" },
  status_SOLD: { en: "Sold", hi: "बिक गया", te: "అమ్మేశారు" },
} satisfies Record<string, Entry>;

export type I18nKey = keyof typeof dict;

export function t(lang: Lang, key: I18nKey): string {
  return dict[key][lang] ?? dict[key].en;
}

export function isLang(v: string | undefined | null): v is Lang {
  return v === "en" || v === "hi" || v === "te";
}

// Status → visual identity. The icon + colour ARE the primary signal; the
// translated label is reinforcement. Used by worker mode and StatusBadge.
export const STATUS_VISUALS: Record<string, { icon: string; className: string }> = {
  NEEDS_PHOTOS: { icon: "📷", className: "bg-amber-100 text-amber-900 border-amber-300" },
  IN_STOCK: { icon: "✅", className: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  READY_TO_DISPATCH: { icon: "🚚", className: "bg-blue-100 text-blue-900 border-blue-300" },
  HOLD: { icon: "✋", className: "bg-orange-100 text-orange-900 border-orange-300" },
  PARTIALLY_SOLD: { icon: "◐", className: "bg-purple-100 text-purple-900 border-purple-300" },
  SOLD: { icon: "💰", className: "bg-red-100 text-red-900 border-red-300" },
};

export function statusLabel(lang: Lang, status: string): string {
  const key = `status_${status}` as I18nKey;
  return key in dict ? t(lang, key) : status;
}

// Preset status-change reasons for worker mode: shown translated, stored in
// English (the `en` value) so the audit log reads consistently for management.
export const WORKER_REASONS: { en: string; hi: string; te: string }[] = [
  { en: "Sold to customer", hi: "ग्राहक को बेचा", te: "కస్టమర్‌కి అమ్మారు" },
  { en: "Customer hold", hi: "ग्राहक के लिए होल्ड", te: "కస్టమర్ కోసం హోల్డ్" },
  { en: "Ready for dispatch", hi: "भेजने के लिए तैयार", te: "పంపడానికి సిద్ధం" },
  { en: "Back in stock", hi: "वापस स्टॉक में", te: "తిరిగి స్టాక్‌లోకి" },
  { en: "Manager asked", hi: "मैनेजर ने कहा", te: "మేనేజర్ చెప్పారు" },
];
