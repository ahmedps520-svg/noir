import { Platform } from "react-native";
import { getApp } from "@react-native-firebase/app";
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";

let initPromise: Promise<any> | null = null;

/**
 * Development uses Firebase's App Check debug provider.
 * Production switches to App Attest with DeviceCheck fallback on Apple.
 *
 * The debug token is intentionally NOT stored in the project. Firebase
 * generates a local token in debug mode; register that token in the
 * Firebase Console under App Check → Apps → NOIR → Manage debug tokens.
 */
export function initializeNoirAppCheck() {
  if (Platform.OS === "web") return Promise.resolve(null);
  if (initPromise) return initPromise;

  const provider = new ReactNativeFirebaseAppCheckProvider();

  provider.configure({
    apple: {
      provider: __DEV__ ? "debug" : "appAttestWithDeviceCheckFallback",
    },
    android: {
      provider: __DEV__ ? "debug" : "playIntegrity",
    },
    web: {
      provider: "debug",
    },
  });

  initPromise = initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  }).then(async appCheck => {
    if (__DEV__) {
      try {
        const { token } = await getToken(appCheck, true);
        console.log("FIREBASE APP CHECK DEBUG TOKEN:", token);
        console.log("Register this token in Firebase Console → App Check → Apps → NOIR → Manage debug tokens.");
      } catch (error) {
        console.warn("NOIR App Check debug token could not be obtained yet.", error);
      }
    }

    return appCheck;
  });

  return initPromise;
}
