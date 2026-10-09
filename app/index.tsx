import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import Type, { BodySm, Hero, Micro } from "../components/Type";
import { color, hit, space } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { resolvePostAuthRoute } from "../services/routing";

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();
  const [resolving, setResolving] = useState(true);
  const routed = useRef(false);

  // A returning user should land where they left off rather than being walked
  // through the intro again. A brand new user falls through to the welcome.
  useEffect(() => {
    if (authLoading || subscriptionLoading || routed.current) return;

    if (!user) {
      setResolving(false);
      return;
    }

    routed.current = true;
    let alive = true;

    (async () => {
      try {
        const destination = await resolvePostAuthRoute(isNoirPlus);
        if (!alive) return;
        router.replace(destination);
      } catch {
        // Offline or Firestore unavailable: fall back to the welcome screen
        // instead of trapping the user on a spinner.
        if (alive) {
          routed.current = false;
          setResolving(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, subscriptionLoading, user, isNoirPlus]);

  if (authLoading || subscriptionLoading || resolving) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground />
        <View style={styles.loading}>
          <Hero style={styles.wordmark}>NOIR</Hero>
          <ActivityIndicator color={color.textFaint} size="small" style={styles.spinner} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground />

      <View style={styles.top}>
        <Micro>N°01</Micro>
        <Micro>Cosmic profile</Micro>
      </View>

      <Reveal delay={120} distance={22} duration={780} style={styles.center}>
        <Micro style={styles.eyebrow}>Welcome to</Micro>
        <Hero style={styles.wordmark}>NOIR</Hero>
        <BodySm center style={styles.tagline}>
          Your place in the cosmos.
        </BodySm>
        <CelestialScene compact />
      </Reveal>

      <Reveal delay={480}>
        <NoirButton label="Begin your profile" filled onPress={() => router.push("/onboarding")} />
        <Pressable
          onPress={() => router.push("/auth")}
          style={styles.signIn}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Type variant="bodySm" tone="muted" center>
            Already have a NOIR account?{"  "}
            <Type variant="bodySm" tone="high">
              Sign in
            </Type>
          </Type>
        </Pressable>
      </Reveal>

      <Micro center tone="faint" style={styles.footer}>
        Private · Personal · Cosmic
      </Micro>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: space.xxl,
    paddingVertical: space.xl,
    justifyContent: "space-between",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  spinner: { marginTop: space.xxl },
  top: { flexDirection: "row", justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: { letterSpacing: 2.5 },
  // A four-letter logotype earns wide tracking; body copy never does.
  wordmark: { letterSpacing: 10, marginTop: space.sm, marginLeft: 10 },
  tagline: { marginTop: space.md, letterSpacing: 0.3 },
  signIn: { minHeight: hit.min, justifyContent: "center", marginTop: space.md },
  footer: { marginTop: space.lg, letterSpacing: 1.6 },
});
