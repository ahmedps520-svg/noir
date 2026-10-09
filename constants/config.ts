/**
 * NOIR runtime configuration.
 *
 * Everything here is client-safe. Values that must match an external dashboard
 * (App Store Connect, Firebase Console) are called out inline.
 */

/* ------------------------------------------------------------------ *
 * AI — Firebase AI Logic / Gemini
 * ------------------------------------------------------------------ */

/**
 * Gemini models, in preference order.
 *
 * Checked against https://firebase.google.com/docs/ai-logic/models (Oct 2026):
 *   gemini-3.5-flash       stable, earliest shutdown 2027-05-19
 *   gemini-3.5-flash-lite  stable, earliest shutdown 2027-07-21
 *
 * Do not reintroduce gemini-2.0-flash (shut down 2026-06-01) or
 * gemini-2.5-flash (restricted to projects that used it before). Re-check that
 * page before changing this — model availability moves every few months, and a
 * retired id fails every reading.
 */
export const NOIR_AI_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite"] as const;

/**
 * Token caps leave real headroom: Gemini 3 models spend part of
 * maxOutputTokens on internal thinking, so a tight cap can return truncated
 * JSON. Thinking is set LOW — a reading is writing, not reasoning — which keeps
 * latency down and the budget for the text itself.
 */
export const NOIR_AI_GENERATION = {
  temperature: 0.85,
  thinkingLevel: "LOW" as const,
  previewMaxOutputTokens: 3072,
  dailyMaxOutputTokens: 3072,
  fullMaxOutputTokens: 8192,
};

/* ------------------------------------------------------------------ *
 * Google Sign-In
 * ------------------------------------------------------------------ */

/**
 * OAuth **Web** client ID for the Firebase project (noir-60abb).
 *
 * On iOS this is optional: GoogleSignin reads the iOS client ID straight from
 * GoogleService-Info.plist, and Firebase Auth accepts an ID token issued to any
 * OAuth client in the same Google Cloud project. Leave it empty for iOS-only.
 *
 * Set it if you ship Android or need a server auth code. Find it at
 * Firebase Console -> Project settings -> General -> "Web client (auto created
 * by Google Service)". It MUST begin with the project number 293502846273-.
 *
 * NOTE: this used to be hardcoded to 1007178330256-... which belongs to a
 * different Google Cloud project, so Google Sign-In could never succeed.
 */
export const GOOGLE_WEB_CLIENT_ID = "";

/* ------------------------------------------------------------------ *
 * NOIR+ subscription
 * ------------------------------------------------------------------ */

/**
 * StoreKit product identifiers.
 *
 * These must match auto-renewable subscription products created in
 * App Store Connect under the bundle id com.noir.cosmos, inside a single
 * subscription group so the user can switch between them.
 *
 * The 3-day free trial is configured in App Store Connect as an
 * *Introductory Offer* on these products — it is not something the app sets.
 */
export const NOIR_PLUS_PRODUCTS = {
  monthly: "com.noir.cosmos.plus.monthly",
  weekly: "com.noir.cosmos.plus.weekly",
} as const;

export const NOIR_PLUS_PRODUCT_IDS: string[] = [
  NOIR_PLUS_PRODUCTS.monthly,
  NOIR_PLUS_PRODUCTS.weekly,
];

/**
 * Fallback pricing copy, shown only until StoreKit returns real localized
 * prices. Real prices always win — never present these as final.
 */
export const NOIR_PLUS_FALLBACK_PRICING = {
  monthly: { price: "$7.99", period: "month" },
  weekly: { price: "$3.99", period: "week" },
  trialDays: 3,
};

/* ------------------------------------------------------------------ *
 * Legal
 * ------------------------------------------------------------------ */

/**
 * App Review requires a paywall to link functional Terms of Use and Privacy
 * Policy pages. `termsUrl` defaults to Apple's standard EULA, which Apple
 * accepts. `privacyUrl` MUST be your own hosted policy — the paywall hides the
 * link while it is empty, and App Review will reject the build without it.
 */
export const NOIR_LEGAL = {
  termsUrl: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  /**
   * Served by Firebase Hosting from hosting/privacy. LIVE ONLY AFTER
   * `firebase deploy --only hosting` — until then this link 404s, and App
   * Review rejects a subscription app whose privacy link is dead.
   */
  privacyUrl: "https://noir-60abb.web.app/privacy",
  /** Enter this as the Support URL in App Store Connect (required). */
  supportUrl: "https://noir-60abb.web.app/support",
  /** Shown in Settings as a support contact. Hidden while empty. */
  supportEmail: "",
};

/**
 * True only in the separate Expo Go preview project, where every native
 * service (Firebase, Gemini, App Check, StoreKit) is stubbed. The production
 * project keeps this false so the paywall never claims to be a simulation.
 */
export const IS_PREVIEW_BUILD = false;

/**
 * Development-only simulated purchase.
 *
 * Set to `true` ONLY to exercise the post-purchase flow on a simulator or a
 * device without a StoreKit sandbox account. It is force-disabled in release
 * builds, and any entitlement it grants is tagged `source: "dev-mock"` and is
 * rejected by `isEntitlementValid()` outside __DEV__ — so a simulated purchase
 * can never unlock NOIR+ in production.
 */
export const DEV_MOCK_PURCHASE_ENABLED = __DEV__ && false;
