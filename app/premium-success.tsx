import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import PremiumCelebration from "../components/PremiumCelebration";
import { Body, BodySm, Display, Micro } from "../components/Type";
import { NOIR_LEGAL } from "../constants/config";
import { color, space } from "../constants/theme";
import { useSubscription } from "../context/SubscriptionContext";
import {
  generateReading,
  getSavedProfile,
  getSavedReading,
  hasReadingContent,
} from "../services/reading";

export default function PremiumSuccess() {
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();
  const [celebrationDone, setCelebrationDone] = useState(false);
  const [readingReady, setReadingReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [profileMissing, setProfileMissing] = useState(false);

  // This screen is only reachable with a confirmed entitlement. Anyone who
  // lands here without one goes back to the paywall.
  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isNoirPlus) router.replace("/paywall");
  }, [subscriptionLoading, isNoirPlus]);

  // Generate the full reading behind the celebration so the wait is hidden.
  useEffect(() => {
    if (subscriptionLoading || !isNoirPlus) return;

    let alive = true;
    setError("");
    setProfileMissing(false);

    (async () => {
      try {
        const existing = await getSavedReading("fullReading");
        if (hasReadingContent(existing)) {
          if (alive) setReadingReady(true);
          return;
        }

        const profile = await getSavedProfile();
        if (!profile || !profile.birthDate) {
          if (alive) setProfileMissing(true);
          throw new Error("NOIR couldn't find your birth details, so it can't write your reading yet.");
        }

        await generateReading(profile, true);
        if (alive) setReadingReady(true);
      } catch (e) {
        if (alive) setError((e as Error)?.message || "Your full reading could not be generated.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [subscriptionLoading, isNoirPlus, attempt]);

  useEffect(() => {
    if (celebrationDone && readingReady && !error) router.replace("/full-reading");
  }, [celebrationDone, readingReady, error]);

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.center}>
          <Micro tone="plus">NOIR+ is active</Micro>
          <Display center style={styles.title}>
            Your subscription is safe.
          </Display>
          <Body tone="danger" center style={styles.error}>
            {error}
          </Body>
          <BodySm tone="dim" center style={styles.note}>
            You have been charged nothing extra — NOIR+ is active on your account and your reading
            can be generated again at any time.
          </BodySm>
          <View style={styles.actions}>
            {profileMissing ? (
              <NoirButton label="Add my birth details" filled onPress={() => router.replace("/onboarding")} />
            ) : (
              <NoirButton label="Try again" filled onPress={() => setAttempt(a => a + 1)} />
            )}
            <NoirButton label="Get help" quiet onPress={() => Linking.openURL(NOIR_LEGAL.supportUrl)} />
            <NoirButton label="Go to NOIR" quiet onPress={() => router.replace("/home")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (celebrationDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground />
        <View style={styles.center}>
          <ActivityIndicator color={color.textHigh} size="small" />
          <Micro tone="muted" style={styles.kicker}>
            NOIR / Unlocking
          </Micro>
          <Display center>Revealing your full reading.</Display>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <PremiumCelebration onDone={() => setCelebrationDone(true)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space.xxl },
  kicker: { marginTop: space.xl },
  title: { marginTop: space.md },
  error: { marginTop: space.lg },
  note: { marginTop: space.md },
  actions: { marginTop: space.xxxl, alignSelf: "stretch", gap: space.sm },
});
