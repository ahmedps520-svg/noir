import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { AuthProvider } from "../context/AuthContext";
import { SubscriptionProvider } from "../context/SubscriptionContext";
import NotificationBridge from "../components/NotificationBridge";
import { initializeNoirAppCheck } from "../firebase/appCheck";
import { configureNotificationHandler } from "../services/notifications";
import { color } from "../constants/theme";

// App Check must be attested before the first Firebase AI request, so start it
// as the module loads rather than waiting for a screen to mount.
if (Platform.OS === "ios" || Platform.OS === "android") {
  initializeNoirAppCheck().catch(error => {
    if (__DEV__) {
      console.warn("NOIR App Check initialization failed:", error);
    }
  });
}

// Must be set before any notification listener is registered.
configureNotificationHandler();

// Hold the native splash until the typefaces are ready, otherwise the first
// frame renders in the system font and visibly reflows.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (fontError && __DEV__) {
      console.warn("NOIR: fonts failed to load, falling back to system.", fontError);
    }
  }, [fontError]);

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // A font failure must not brick the app — render with system fallbacks.
  if (!ready) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: color.bg }} onLayout={onLayout}>
        <AuthProvider>
          <SubscriptionProvider>
            <NotificationBridge />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "fade",
                animationDuration: 260,
                contentStyle: { backgroundColor: color.bg },
              }}
            />
          </SubscriptionProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}
