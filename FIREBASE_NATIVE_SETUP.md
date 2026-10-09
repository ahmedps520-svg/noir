# Firebase native setup for NOIR

NOIR now uses React Native Firebase for the native Gemini/AI Logic path.

## Required Firebase files

Download these from Firebase Console and put them in the project root:

- `google-services.json` for Android
- `GoogleService-Info.plist` for iOS

They must belong to the matching Firebase apps and use the NOIR bundle/package IDs:
- iOS: `com.noir.cosmos`
- Android: `com.noir.cosmos`

Do not upload these files to a public repository.

## Important: Expo Go

React Native Firebase uses native code and therefore does NOT run inside the prebuilt Expo Go app. Use an Expo development build.

Typical workflow on Windows:

```cmd
npm install
npx expo prebuild --clean
npx eas build --profile development --platform android
```

For iOS, because you do not have a Mac, use EAS Build to create the iOS development build after the Apple Developer account and iOS Firebase app are configured.

## App Check

AI Logic is now protected by Firebase App Check in the Firebase project. During development, use the appropriate App Check debug provider and register the generated debug token in Firebase Console. Never ship a debug token in production.

## AI

The NOIR AI service uses Firebase AI Logic with the Gemini Developer API backend and `gemini-2.5-flash-lite` for the initial low-cost text generation.

The preview/full distinction is handled by the prompt. Production should also enforce subscription entitlement server-side before allowing full readings.

## Do not add a Gemini API key to the app.

Firebase AI Logic is the intended client-side path and provides the Firebase proxy/App Check integration.
