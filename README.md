# NOIR v6 — Firebase + AI + premium flow

This version adds:
- No location quick choices.
- - Persistent Persistent Firebase Authentication with AsyncStorage.
- - User profile saved to Firestore.
- Firebase AI Logic / Gemini reading generation.
- AI output is personalized from the onboarding answers + birth data.
- Premium upgrade celebration animation.
- Existing NOIR top navigation and easier birth entry remain.

## Important: one-time Firebase connection
I cannot connect this project to your Firebase project without its Firebase Web App configuration.

Firebase Web configuration is already included in `firebase/config.ts`.
Firebase Console → Project settings → Your apps → Web app.

Do NOT put a Gemini API key in the app. Firebase AI Logic is designed to keep the Gemini key behind Firebase's proxy; Firebase recommends App Check for production protection.

Then in Firebase Console:
1. Enable Authentication → Email/Password.
2. Create Firestore Database.
3. In AI Services → AI Logic, choose the Gemini Developer API to start.
4. Configure App Check before production.

The official Firebase docs say Firebase AI Logic supports React Native, and authenticated-users mode can require Firebase Authentication before Gemini requests are accepted.

## Install
npm install
npx expo start

## Production
Apple subscription checkout is intentionally separated from the UI. The premium celebration is already wired to the upgrade flow, but the actual $7.99/month and $3.99/week products must be created in App Store Connect and connected with StoreKit before release.


## Firebase project connected

The Firebase Web App configuration for project `noir-60abb` is in `firebase/config.ts`.

Before running:
1. In Firebase Console, enable Authentication → Email/Password.
2. Create Firestore Database.
3. Run `npm install`.
4. Run `npx expo start`.

Do not share passwords, service-account keys, or private credentials. The Firebase client config is not a service-account secret.


## Firebase AI Logic native integration

The project now uses `@react-native-firebase/ai` for the real Gemini integration. Firebase AI Logic supports React Native, and React Native Firebase requires an Expo development build rather than Expo Go.

See `FIREBASE_NATIVE_SETUP.md`.

The temporary `/ai-test` screen generates a real preview once the native Firebase files, App Check debug setup, and development build are ready.


## Account policy

NOIR does NOT use anonymous accounts. Users create or sign into a real account using:
- Apple
- Google
- Email/password

Google requires a Firebase Web Client ID for the native Google Sign-In configuration. Replace the placeholder in `services/auth.ts` with the OAuth 2.0 Web client ID from Firebase/Google Cloud.

Apple Sign-In requires the Apple Developer configuration and the Sign in with Apple capability on the `com.noir.cosmos` App ID. The Firebase Apple provider must also be configured before production use.

The preview now offers account creation before the user proceeds to the premium/full-reading experience.

## AI generation

NOIR uses Firebase AI Logic with `@react-native-firebase/ai` and Gemini for personalized preview/full readings. See `AI-CONNECTION-SETUP.md` for Firebase console and development-build setup.
