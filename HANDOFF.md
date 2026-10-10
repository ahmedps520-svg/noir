# NOIR — Full Handoff for the Next Engineer (AI or human)

State as of 2026-10-09. Everything here was verified in code, in a browser preview, or with independent calculations unless it says otherwise.

## 0. Your role

You are taking over NOIR, a nearly finished iOS app that needs to ship on the App Store. The owner is a solo founder: not a full-time engineer, writes short messages (often with typos), and expects you to do the work end to end, not hand back homework. Act on requests directly. Explain results in plain language. Be honest about anything unverified, broken or skipped.

Do not rebuild, redesign or "clean up" the app. The design has been reviewed and praised. Change only what a request needs.

## 1. Non-negotiable rules (from the owner — never break these)

- No rebuild. Don't replace the design, remove features, delete screens or delete files. Don't remove `GoogleService-Info.plist`, the Firebase config, the EAS config, assets, auth or AI logic.
- Auth is exactly three methods: Google, Apple, and email + password. No anonymous, guest or demo accounts, ever. `firestore.rules` also rejects anonymous sign-in.
- App Check stays on. Debug provider in dev builds (token comes from the native build's log and is registered in the Firebase Console); App Attest with DeviceCheck fallback in production/TestFlight. Never hardcode a debug token. Never disable App Check.
- No fake payments as the final product. The full reading unlocks only after a verified StoreKit entitlement. Never skip the paywall. The dev mock purchase is triple-guarded (`__DEV__`, `DEV_MOCK_PURCHASE_ENABLED`, and source `"dev-mock"` rejected in release). Leave it that way.
- The exact user flow (don't reorder it): about-you questions → birth info → account → AI preview → NOIR+ paywall → StoreKit purchase (3-day trial, $7.99/month, $3.99/week) → Apple confirms → celebration → full reading unlocks → access persists.
- No HTML elements in React Native code (div, span and so on). RN components only.
- Dependencies: never run `npm audit fix --force`. Never upgrade packages randomly. Expo-compatible versions only (`npx expo install <pkg>`, `npx expo install --check` / `--fix`).
- Always validate before saying you're done: `npx tsc --noEmit` must give zero errors and `npx expo config --json` must succeed (section 15).
- Credentials are the owner's. Never type passwords or API keys, never run `eas login` for them, and never put their email address in code, docs or requests. Deploys (`firebase deploy`) and App Store Connect actions are the owner's (Claude in Cowork helps with those in the browser with their approval).
- Declined ideas stay declined: an earlier review suggestion ("item 1") was rejected as wrong — don't revive speculative "improvements" from reviews without asking. A blurred reading teaser on the paywall was explicitly declined. Don't build it.
- Keep the product angle: "A reading about you — not just your star sign." NOIR combines the person's answers with a real calculated birth chart.

## 2. Project facts

- App name: NOIR. App Store Connect record: "The Noir" (created). Bundle ID: `com.noir.cosmos` (registered). SKU: already set when the record was created (can't be changed).
- Repo: github.com/ahmedps520-svg/noir (public, the owner's choice). This is now the source of truth for the production code.
- Firebase project: `noir-60abb` (project number 293502846273)
- Monthly product: `com.noir.cosmos.plus.monthly` ($7.99, 3-day free trial = App Store Connect Introductory Offer). Weekly: `com.noir.cosmos.plus.weekly` ($3.99, no trial). Both in one subscription group (not created yet, see 16).
- Stack: Expo SDK 54 (expo ~54.0.37), React Native 0.81.5, React 19.1, TypeScript 5.9, Expo Router 6, New Architecture, expo-build-properties iOS useFrameworks "static".
- Firebase: React Native Firebase 25.1.0 (app, auth, firestore, ai, app-check). The JS `firebase` package is also in package.json from before; leave it.
- AI: Firebase AI Logic → Gemini Developer API (GoogleAIBackend). Payments: expo-iap ^3.3.5 (StoreKit 2). Astronomy: astronomy-engine ^2.1.19 (pure JS, on device).
- Other: expo-apple-authentication, @react-native-google-signin/google-signin 16, expo-notifications, expo-haptics, expo-font (Cormorant Garamond + Inter).
- Builds: GitHub Actions workflow "iOS -> TestFlight" (`.github/workflows/ios.yml`, added by you in this session): manual run with a version input; build number = run number; signs with an App Store Connect team API key. Repo secrets set: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`. `eas.json` stays as it is (development / preview / production, appVersionSource remote) but is not used for these builds.
- TestFlight: internal group "My Devices" with automatic distribution; the owner is invited, so every processed build goes to their iPhone and iPad. The owner builds on Windows, so all iOS builds go through GitHub Actions.
- Apple Developer Program: active.

## 3. Codebases — read carefully

- The production app is this repo. It was uploaded on 2026-10-09 from the owner's PC folder `Desktop\Noir app` (minus node_modules and .expo). That PC folder is not a git repo and will NOT receive your changes automatically; treat the repo as the source of truth from now on.
- The web/Expo Go preview is a separate folder on the PC only (`Downloads\NOIR preview`). It is NOT in this repo. It has stubbed services so the UI runs in a browser via react-native-web (`npx expo start --web`): no real Firebase, Gemini, App Check or StoreKit; canned readings; simulated purchases; `IS_PREVIEW_BUILD = true` there (false in production).
- Sync rule: shared UI files (everything in `app/`, `components/`, `hooks/`, `constants/theme.ts`, `services/chart.ts`, `services/astronomy.ts`, `services/cities.ts`, `data/cities.ts`) must stay byte-identical between production and the preview. You can't reach the preview from here, so whenever you change a shared file, list it in your report so it can be copied to the preview. When you change a production service's API (exports or types), say which preview stub needs the same change.
- Preview-only stub files (never copy these into production): `firebase/auth.ts`, `firebase/profile.ts`, `services/auth.ts`, `services/reading.ts`, `services/daily.ts`, `services/subscription.ts`, `services/previewStore.ts`, `constants/config.ts` (differs only in `IS_PREVIEW_BUILD`), and anything else that imports native modules in production.
- Don't invent file contents for anything you can't see.

## 4. File map (production)

- `app/` (Expo Router screens): `_layout.tsx` (fonts, Auth + Subscription providers, notification bridge); `index.tsx` (entry routing); `onboarding.tsx` (5 "About you" questions, steps 01–05 of 06); `birth.tsx` (birth date/time, CityPicker, AI-consent checkbox, step 06/06); `account.tsx` (Apple / Google / email; saves profile); `auth.tsx` (returning sign-in); `generate.tsx` (builds the preview reading, then /preview); `preview.tsx` (free preview: archetype, traits, Sun/Moon/Rising, 2 sections, locked list); `paywall.tsx` (NOIR+ plans from StoreKit, Restore, auto-renew disclosure, Terms + Privacy links); `premium-success.tsx` (celebration; writes the full reading in the background; recoverable errors); `full-reading.tsx` (writes itself if missing; recoverable errors); `home.tsx`; `daily.tsx` (Focus / Relationships / Watch for + journal prompt + reminder offer); `journal.tsx`; `sky.tsx` (live sky); `object.tsx` (planet detail `?name=Venus`); `profile.tsx`; `settings.tsx`; `delete-account.tsx` (Guideline 5.1.1(v)); `ai-test.tsx` (dev diagnostic, not linked; keep it); `+not-found.tsx`.
- `components/`: Type, Card, NoirButton, Reveal, Shimmer, AnimatedNumber, CosmicBackground, CelestialScene, PremiumCelebration, TopNav, CityPicker, BirthDateFields, ChartSignature, AppleSignInButton, ReminderControl, NotificationBridge, InteractiveCard.
- `constants/config.ts`: AI models + generation caps, product IDs, fallback pricing, legal URLs, `IS_PREVIEW_BUILD`, `DEV_MOCK_PURCHASE_ENABLED`, `GOOGLE_WEB_CLIENT_ID` (""). `constants/theme.ts`: design tokens (incl. plus gold #D8C49A).
- `context/`: AuthContext, SubscriptionContext (StoreKit is the authority). `hooks/`: useNoirData, useDaily, useDailyReminder.
- `firebase/`: ai.ts, appCheck.ts, auth.ts, config.ts, profile.ts.
- `services/`: `nativeFirebase.ts` (model creation, fallback, error classification); `reading.ts` (prompts, preview/full generation, Firestore save/load); `daily.ts`; `chart.ts` (natal chart math); `astronomy.ts`; `cities.ts`; `subscription.ts` (expo-iap / StoreKit 2: offers, purchase, verify, restore, entitlement cache); `auth.ts`; `deleteAccount.ts`; `notifications.ts`; `routing.ts` (resolvePostAuthRoute); `account.ts`, `firebase.ts`, `haptics.ts`.
- `data/cities.ts` (generated, ~1.35 MB, GeoNames cities15000, CC BY 4.0) + `scripts/build-cities.cjs`. `hosting/` (privacy, support, legal.css). `firebase.json`, `.firebaserc`, `firestore.rules`. `logo-source/` (the "Orrery rings" logo the owner picked). `SETUP-REQUIRED.md` = the owner's launch checklist (keep it current).
- `.github/workflows/ios.yml`, `.github/scripts/asc-key.sh`, `.gitignore`: added by you in this session.
- Older notes (`AI-CONNECTION-SETUP.md`, `APPCHECK-DEBUG-SETUP.txt`, `CONFIG-FIX.txt`, `FIREBASE-FIX-VERIFIED.txt`, `FIREBASE_NATIVE_SETUP.md`, `NEXT-STEPS.txt`, `README.md`) are from earlier work. Don't delete them. `SETUP-REQUIRED.md` is the current source of truth.

## 5. User flow and routing (as built)

- index → new user → `/onboarding`: 5 different questions, each with a topic, 4 unique options each, never repeated. Counter 01/06 … 05/06. Answers passed on as "Topic: answer" strings. Transitions use timers plus a ref lock (not animation callbacks, which froze onboarding). Double taps are safe.
- `/birth`: day/month/year + hour/minute with auto-advance; CityPicker (must pick a result → lat/lon/IANA timezone; editing the text clears the choice); GeoNames attribution; required AI consent checkbox. Params: date "DD/MM/YYYY", time "HH:MM", place, lat, lon, tz, answers JSON, aiConsent "1".
- `/account`: Apple / Google / email; completeSignIn saves the profile (incl. birthLatitude/Longitude/Timezone and aiConsentAt), then resolvePostAuthRoute().
- `/generate` → `/preview` (preview redirects back to /generate if no reading exists and nothing errored). `/paywall` → purchase → applyEntitlement → `/premium-success` → `/full-reading`. Subscribed users land on `/home` with Today, Journal, Sky and Profile (TopNav).
- resolvePostAuthRoute: profile incomplete → /onboarding; entitled → /home; preview exists → /paywall; otherwise /generate.

## 6. Data model (Firestore)

- `users/{uid}`: displayName, email, birthDate, birthTime, birthPlace, birthLatitude, birthLongitude, birthTimezone (null for older accounts), onboardingAnswers (string[]), aiConsentAt, previewReading, fullReading, noirPlus (entitlement cache), reminder preferences.
- `users/{uid}/dailyReadings/{YYYY-MM-DD}`: focus, relationships, caution, prompt, moonPhase, reflection, reflectionUpdatedAt, createdAt.
- Rules: owner-only read/write/delete; anonymous rejected; everything else closed. Account deletion clears dailyReadings explicitly.

## 7. AI layer

- Models (`constants/config.ts`): `["gemini-3.5-flash", "gemini-3.5-flash-lite"]`, tried in order (checked against firebase.google.com/docs/ai-logic/models in Oct 2026: stable until at least 2027-05-19 and 2027-07-21). Never reintroduce gemini-2.0-flash (shut down 2026-06-01) or gemini-2.5-flash. A previous AI wrongly "corrected" the models to retired ones, which broke every reading. Re-check that docs page before changing models.
- Generation: temperature 0.85, thinkingConfig.thinkingLevel "LOW"; maxOutputTokens preview 3072, daily 3072, full 8192 (thinking uses part of the budget; tight caps truncate the JSON). isModelUnavailableError falls back on "not available", "no longer available", "has been shut down", "retired", "deprecated", "discontinued".
- Sent to Gemini: labelled onboarding answers + calculated chart facts; for daily also today's transits/sky, archetype/traits and recent summaries. Not sent: name, email, raw birth date/time/place, journal reflections. Without a chart, it is told not to name signs.
- Consent (5.1.2): explicit checkbox on /birth naming Google's Gemini AI and linking the privacy policy; nothing reaches Gemini before it's ticked.
- Gemini data terms: on the free (Spark) tier Google may use prompts to improve its products; on Blaze it doesn't. Owner should confirm the plan and adjust the policy if staying free.

## 8. Birth chart and sky (on device; verified)

- `chart.ts`: tropical, geocentric apparent ecliptic of date. birthInstantUtc uses Intl.DateTimeFormat formatToParts for historical offsets (incl. DST). Planets Sun…Pluto; retrograde from motion over one hour centred on the instant. ASC = atan2(cos RAMC, −(sin RAMC·cos ε + tan φ·sin ε)); MC = atan2(sin RAMC, cos RAMC·cos ε). Degrees/minutes truncated, not rounded. chartFromBirthData returns null without coordinates/timezone (UI and prompt handle null). transitAspects: orb 3°, conj/sextile/square/trine/opposition to Sun, Moon, ASC, MC, Venus, Mars. Verified: 14 Mar 1995 08:30 London, Ontario → Sun Pisces 23°, Moon Leo 22°, ASC Taurus 9°; same in Riyadh → ASC Taurus 10°, Moon Leo 17°.
- `astronomy.ts`: Moon phase/sign/illumination; current sky; bodyDetail; upcomingEvents (new/full moons, Sun ingresses, eclipses, Mercury/Venus/Mars stations within 120 days, next meteor shower). findChange steps a day then bisects to 5 minutes. Verified 2026: Mercury retrograde 24 Oct 07:16 UTC, Venus direct 14 Nov 00:22 UTC, Sun enters Scorpio 23 Oct 09:38 UTC. Dates show in device local time.

## 9. Subscriptions (StoreKit 2 via expo-iap)

- Prices/currency from StoreKit displayPrice/currency (local automatically); NOIR never converts; config fallback pricing is copy-only while loading. Purchases verified on device (isTransactionVerifiedIOS). refreshEntitlement() overwrites the Firestore cache on launch and foreground; lapsed/cancelled relocks full and daily readings. Paywall: plans, trial label, CTA, Restore, auto-renew disclosure, Terms of Use (EULA) · Privacy Policy always shown, "Not now".
- Recommended hardening (not built): Cloud Function for App Store Server Notifications v2 writing `users/{uid}.noirPlus`, plus rules stopping clients writing that field.

## 10. Auth, App Check, account deletion

- Google: iOS client ID from `GoogleService-Info.plist`; `GOOGLE_WEB_CLIENT_ID` "" (Android only). Apple: expo-apple-authentication, usesAppleSignIn true. App Check: debug in `__DEV__`, appAttestWithDeviceCheckFallback in production; skipped on web. You added the App Attest entitlement (production) in this session.
- Deletion: re-auth → delete dailyReadings → delete user doc → cancel reminder → best-effort Apple token revocation (needs the Apple key in Firebase) → delete Firebase user → sign out; warns the Apple subscription is billed separately (Manage Subscription).

## 11. Daily readings, journal, notifications

`/daily`: one AI reading per local date, "Your turn" journal prompt (private, never sent to AI), streak, one-time reminder offer (only after reading). Reminder: one local daily notification at a chosen time (default 8 AM), changeable in Settings. Requires NOIR+.

## 12. Legal pages (Firebase Hosting)

`hosting/privacy` and `hosting/support` match what the code does. Placeholders [YOUR NAME OR COMPANY] and [YOUR CONTACT EMAIL] must be filled by the owner before deploying. URLs (live after deploy): https://noir-60abb.web.app/privacy and /support. termsUrl = Apple's standard EULA; supportEmail "" (hidden while empty). Deploy (owner): `firebase deploy --only hosting,firestore:rules`

## 13. Design system

Cormorant Garamond (display), Inter (body/UI). Always use the Type component variants (Display, H1, H2, Body, BodySm, Label, Micro) with tone props. Tokens in `constants/theme.ts`; gold #D8C49A marks NOIR+. Motion: Reveal, Shimmer, AnimatedNumber, CelestialScene, PremiumCelebration; haptics via `services/haptics.ts`. Black, editorial, quiet; short second-person copy, no "cosmic fluff". Every error screen gives a next step.

## 14. Work completed (latest first)

- 2026-10-09 (this session): GitHub repo created and production code uploaded; "iOS -> TestFlight" workflow + ASC key cleaner; .gitignore; App Attest entitlement; Firebase modules linked statically; version/build number now reach Info.plist. App Store Connect record, internal TestFlight group and repo secrets set up in the browser by Claude (Cowork).
- Second external review: full reading writes itself when NOIR+ is active; every error screen has a way forward (incl. "NOIR needs your birth details"); paywall legal links always visible, currency line removed; preview state persists across reloads. (Declined: blurred teaser.)
- First external review: onboarding questions replaced, counter 01–06; Sky rebuilt with real calculations; real on-device birth chart + offline city search; privacy/support pages + AI consent; "preview isn't ready" fixed (retired Gemini IDs); city taps, consent checkbox ARIA, stations off by a day fixed.
- Earlier: typography/design overhaul; react-native-web preview; daily readings + journal + streak; daily notification; animations; local currency; fixed un-typeable birth fields; new logo; in-app account deletion.

## 15. Validation (after any change)

`npx tsc --noEmit` (exit 0, no output); `npx expo config --json` (succeeds, bundle com.noir.cosmos, sdk 54); `npx expo install --check` ("Dependencies are up to date"). For shared UI files, list them for copying to the preview (section 3). For astronomy/chart changes, check against an independent calculation first. The real iOS compile/sign/upload is only proven by a successful "iOS -> TestFlight" run.

## 16. What's still open

Done since the old checklist: App Store Connect app record; TestFlight internal group; build pipeline (GitHub Actions instead of EAS for now).

Build pipeline proven: run #1 of "iOS -> TestFlight" succeeded on 2026-10-09 (21 min). Archive, signing (incl. the Sign in with Apple, Push and App Attest capabilities) and upload all passed; the first build, NOIR 1.0 (1), was uploaded to App Store Connect and reaches the owner's iPhone and iPad through the "My Devices" TestFlight group once Apple processes it.

First device test of 1.0 (1), 2026-10-09 (iPhone, iOS 27.0) — three problems, each part code and part console:

- Continue with Apple → "That sign-in method isn't enabled for NOIR yet" (`auth/operation-not-allowed`): the Apple provider isn't enabled in Firebase Authentication (console step A2). Code bug found behind it: the Apple credential was given Apple's authorization code where React Native Firebase expects the raw nonce, so Apple sign-in would still have failed once enabled. Fixed in `services/auth.ts` (sign-in and re-auth): Apple now gets the SHA-256 of a random nonce and Firebase gets the raw nonce. New dependency `expo-crypto` ~15.0.9 (added with `npx expo install`). The authorization code is still used only for token revocation on deletion.
- Google's account picker said "continue to project-…" instead of NOIR: the Firebase public-facing name (= the OAuth consent screen app name) was never set; it defaults to "project-<project number>". Console only (step A3), no code change.
- Readings failed with `[401] Firebase App Check token is invalid` (AI/fetch-error): code bug — `services/nativeFirebase.ts` initialized App Check but never passed the instance to `getAI`, so AI requests carried no App Check token at all, and App Check enforcement for Firebase AI Logic is already on. Fixed by passing `appCheck` to `getAI`. App Attest must also be registered for the iOS app in App Check (step A1), or tokens still can't be issued.
- Checked and fine: run #1's log shows the signed app carries `aps-environment`, Sign in with Apple and App Attest (`production`) entitlements; `firebase/appCheck.ts` uses App Attest with DeviceCheck fallback in release and debug only in `__DEV__`.
- Both code fixes need a new build (1.0 (2) or later). Validated with tsc, `expo config`, `expo install --check` and a prebuild + pod install dry run; not yet verified on a device.

Console fix-up steps from that test (owner, in order):

- A1. Apple Developer → Keys → new key with DeviceCheck and Sign in with Apple (primary App ID com.noir.cosmos) → download the .p8 once, note the Key ID. Firebase → App Check → Apps → NOIR (iOS) → App Attest: Team ID → Save; DeviceCheck: that key + Key ID + Team ID → Save. App Check → APIs → Firebase AI Logic → Unenforce until verified requests show on a device (item 3 below).
- A2. Firebase → Authentication → Sign-in method → Add new provider → Apple → Enable; the OAuth code flow fields (Team ID, Key ID, .p8 from A1) cover item 6 below → Save.
- A3. Firebase → Project settings → General → Public-facing name → "NOIR" → Save. (No logo on the Google consent screen — a logo triggers Google brand verification.)
- A4. Run "iOS -> TestFlight" (version 1.0) → build 1.0 (2); test Apple sign-in, the Google picker name and a reading; then App Check → APIs → Firebase AI Logic → Enforce once its metrics show verified requests.

Build 1.0 (2), tested 2026-10-10 (iPhone, iOS 27.0), after steps A1–A3 were done: Apple sign-in works. Readings failed with `[403] Firebase AI Logic has been deactivated in this project. To resume using Firebase AI Logic, you must enforce Firebase App Check.` App Check state at the time (owner set, leave as is): Firebase AI Logic Basic = Enforced, Replay protection = Monitoring; chart 0% verified / 100% unverified. Per firebase.google.com/docs/ai-logic/error-codes, with replay protection on (even monitor-only) only limited-use tokens count as verified for AI Logic. Fix: `services/nativeFirebase.ts` now passes `useLimitedUseAppCheckTokens: true` to `getAI` (React Native Firebase forwards limited-use requests to the App Attest provider). Validated with tsc and `expo config`; ships in build 1.0 (3). Not yet verified on a device. The same docs page says the project's AI Logic activity is reassessed daily, so the 403 may take up to a day to clear after verified requests start.

Owner actions still open (keep `SETUP-REQUIRED.md` in this order, updated for the GitHub Actions/TestFlight path):

1. Sign the Paid Applications Agreement + banking/tax (otherwise StoreKit returns no products).
2. Create both subscriptions in one group; 3-day free-trial Introductory Offer on monthly.
3. Firebase Console → App Check: make sure the NOIR iOS app has the App Attest provider (and DeviceCheck for the fallback) registered. TestFlight builds are release builds, so they use App Attest and need no debug token (the debug-token step only applies to dev-client builds). Keep enforcement off until readings are confirmed on a device. (Found enforced on 2026-10-09 — see A1.)
4. Fill in the hosting placeholders → `firebase deploy --only hosting,firestore:rules` → add the Privacy Policy and Support URLs in App Store Connect → fill in the App Privacy label (email, user content, birth details, user ID; linked to user; app functionality only; no tracking).
5. Test a real purchase on the TestFlight build (TestFlight uses the sandbox automatically with the tester's normal Apple ID; a separate sandbox tester is only needed for dev builds).
6. Add the Sign in with Apple key (.p8, Key ID, Team ID) to the Firebase Apple provider so token revocation works on deletion. (See A1–A2.)
7. Confirm the Gemini plan/data terms (section 7).

Real AI reading quality hasn't been reviewed on a device yet; the first TestFlight run should judge it.

Known product gaps (not built): editing birth details after sign-up (an edit screen that recomputes the chart and regenerates readings would also fix older profiles without coordinates); server-side receipt validation; optional supportEmail row.

App Review notes to prepare: AI consent screen (5.1.2), in-app account deletion (5.1.1(v)), chart calculated on device from real astronomy (helps with 4.3(b)).

## 17. Lessons learned

- Don't "correct" model IDs or APIs from memory; check the official docs first.
- Never gate state transitions on Animated start callbacks; use timers and refs.
- Never make a list's visibility depend on input focus when the user has to tap that list.
- Never wrap TextInputs in a keyboard-dismissing Pressable; use `keyboardShouldPersistTaps="handled"`.
- Use functional state updates in multi-field inputs.
- Never put backticks inside double-quoted shell strings (one accidentally ran `firebase deploy`).
- After installing packages or adding files in Expo, restart Metro with `--clear` if resolution looks stale.
- Be honest in reports: verified vs reasoned vs needs a device.

## 18. Reporting to the owner

Plain, short, direct. Lead with what now works, then what changed (by the item raised), how it was verified, what they must do themselves (exact steps, where to click), and anything unverified or skipped. Answer numbered lists by number. Don't pad or re-explain earlier work unless asked. The owner often works through Claude in the browser, which may relay build logs and results to you.
