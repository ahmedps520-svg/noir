import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import NoirButton from "../components/NoirButton";
import { Body, Display, Micro } from "../components/Type";
import { color, space } from "../constants/theme";
import { normalizeAnswers } from "../firebase/profile";
import { generateReading, getSavedProfile, type ProfileInput } from "../services/reading";
import { chartFromBirthData } from "../services/chart";
import { successFeedback } from "../services/haptics";

const STAGES = [
  "Reading your answers",
  "Placing your birth sky",
  "Finding your patterns",
  "Composing your profile",
];

export default function Generate() {
  const params = useLocalSearchParams();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  // Ambient pulse for the current stage label.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const resolveInput = useCallback(async (): Promise<ProfileInput> => {
    // Prefer the values just collected; fall back to Firestore when this screen
    // is reached directly (e.g. a returning user resuming the flow).
    const fromParams: ProfileInput = {
      answers: normalizeAnswers(params.answers),
      birthDate: String(params.date ?? ""),
      birthTime: String(params.time ?? ""),
      birthPlace: String(params.place ?? ""),
      chart: chartFromBirthData({
        birthDate: String(params.date ?? ""),
        birthTime: String(params.time ?? ""),
        latitude: params.lat ? Number(params.lat) : null,
        longitude: params.lon ? Number(params.lon) : null,
        timezone: params.tz ? String(params.tz) : null,
      }),
    };

    if (fromParams.birthDate && fromParams.birthTime && fromParams.birthPlace) return fromParams;

    const saved = await getSavedProfile();
    if (!saved || !saved.birthDate) {
      throw new Error("NOIR could not find your birth information. Please complete onboarding again.");
    }
    return saved;
  }, [params.answers, params.date, params.place, params.time, params.lat, params.lon, params.tz]);

  useEffect(() => {
    let alive = true;
    setError("");
    setStage(0);
    progress.setValue(0);

    // Creep toward 90% while the model works, then snap to 100% on success —
    // the bar reflects real completion rather than a fake timer.
    const creep = Animated.timing(progress, {
      toValue: 0.9,
      duration: 9000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    creep.start();

    const ticker = setInterval(() => {
      if (alive) setStage(current => Math.min(current + 1, STAGES.length - 1));
    }, 2200);

    (async () => {
      try {
        const input = await resolveInput();
        await generateReading(input, false);
        if (!alive) return;

        creep.stop();
        Animated.timing(progress, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          if (!alive) return;
          successFeedback();
          router.replace("/preview");
        });
      } catch (e) {
        if (!alive) return;
        creep.stop();
        setError((e as Error)?.message || "NOIR could not build your profile.");
      } finally {
        clearInterval(ticker);
      }
    })();

    return () => {
      alive = false;
      clearInterval(ticker);
      creep.stop();
    };
  }, [attempt, resolveInput, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.errorWrap}>
          <Micro style={styles.kicker}>NOIR / Interrupted</Micro>
          <Display>We couldn't finish that.</Display>
          <Body tone="danger" style={styles.errorText}>
            {error}
          </Body>
          <View style={styles.errorActions}>
            <NoirButton label="Try again" filled onPress={() => setAttempt(a => a + 1)} />
            <NoirButton label="Start over" quiet onPress={() => router.replace("/onboarding")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground />
      <CelestialScene />
      <View>
        <Micro style={styles.kicker}>NOIR / Calculating</Micro>
        <Display>Building your profile</Display>

        <Animated.View
          style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }}
        >
          <Micro tone="muted" style={styles.stage}>
            {STAGES[stage]}
          </Micro>
        </Animated.View>

        <View style={styles.bar}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg, padding: space.xxl, justifyContent: "center" },
  kicker: { marginBottom: space.md },
  stage: { marginTop: space.xl, letterSpacing: 1.6 },
  bar: { height: 2, backgroundColor: "rgba(255,255,255,0.09)", marginTop: space.lg, overflow: "hidden" },
  fill: { height: 2, backgroundColor: color.textHigh },
  errorWrap: { flex: 1, justifyContent: "center" },
  errorText: { marginTop: space.lg },
  errorActions: { marginTop: space.xxxl, gap: space.sm },
});
