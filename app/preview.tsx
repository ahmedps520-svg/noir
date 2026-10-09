import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import ChartSignature from "../components/ChartSignature";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import Shimmer from "../components/Shimmer";
import Type, { Body, BodySm, H1, H2, Label, Micro } from "../components/Type";
import { color, radius, space } from "../constants/theme";
import { useNatalChart, useNoirReading } from "../hooks/useNoirData";
import { hasReadingContent } from "../services/reading";

const LOCKED_SECTIONS = [
  { title: "Ambition", teaser: "What actually moves you, and what you mistake for motivation." },
  { title: "Your patterns", teaser: "The loops you repeat — and the one worth breaking first." },
  { title: "Today", teaser: "A daily outlook written against your own profile." },
];

export default function Preview() {
  const { data: reading, loading, error, reload } = useNoirReading("previewReading");
  const { chart } = useNatalChart();
  const ready = hasReadingContent(reading);

  // No preview yet (a resumed session, a reinstall, or a write that never
  // landed) is not an error the person can act on — go and make one. Only a
  // genuine load failure stays on this screen with a retry.
  const missing = !loading && !error && !ready;
  useEffect(() => {
    if (missing) router.replace("/generate");
  }, [missing]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.skeleton}>
          <Micro tone="muted" style={styles.loadingText}>Revealing your preview</Micro>
          <Shimmer lines={4} />
          <View style={styles.skeletonGap} />
          <Shimmer lines={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ready && !error) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.center}>
          <Micro>NOIR / Preview</Micro>
          <Body tone="danger" center style={styles.errorText}>
            {error}
          </Body>
          <View style={styles.errorActions}>
            <NoirButton label="Try again" filled onPress={reload} />
            <NoirButton label="Rebuild my profile" quiet onPress={() => router.replace("/generate")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Reveal>
          <Micro style={styles.kicker}>Your NOIR</Micro>
          <H1 style={styles.archetype}>{reading.archetype}</H1>
          {reading.traits.length > 0 && (
            <Micro tone="muted" style={styles.traits}>
              {reading.traits.join("   ·   ")}
            </Micro>
          )}
          <ChartSignature chart={chart} />
        </Reveal>

        <CelestialScene compact />

        <Reveal delay={140}>
          <Section title="Your core" text={reading.core} />
          {!!reading.relationships && (
            <Section title="Your relationships" text={reading.relationships} />
          )}
        </Reveal>

        <Reveal delay={280}>
          <Label tone="plus" style={styles.lockedHeading}>
            Locked in NOIR+
          </Label>
          {LOCKED_SECTIONS.map(section => (
            <View key={section.title} style={styles.lockedRow}>
              <View style={styles.lockedText}>
                <Type variant="title" tone="muted">
                  {section.title}
                </Type>
                <BodySm tone="dim" style={styles.lockedTeaser}>
                  {section.teaser}
                </BodySm>
              </View>
              <Type variant="title" tone="faint">
                ⌁
              </Type>
            </View>
          ))}
        </Reveal>

        <Reveal delay={400}>
          <Card tone="plus" style={styles.unlock}>
            <Micro tone="plus">NOIR+ preview</Micro>
            <H2 style={styles.unlockTitle}>A glimpse of your profile.</H2>
            <BodySm style={styles.unlockSub}>
              This is only the beginning. Your full reading goes deeper into personality,
              relationships, ambition, patterns and your daily cosmic outlook.
            </BodySm>
            <NoirButton label="Continue to NOIR+" plus onPress={() => router.push("/paywall")} />
          </Card>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.section}>
      <Label style={styles.sectionLabel}>{title}</Label>
      <Body>{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  container: { padding: space.xxl, paddingBottom: space.giant },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  loadingText: { marginBottom: space.xxl },
  skeleton: { flex: 1, paddingHorizontal: space.xxl, paddingTop: space.xxxl },
  skeletonGap: { height: space.xxl },
  kicker: { marginBottom: space.sm },
  archetype: { fontSize: 40, lineHeight: 46 },
  traits: { marginTop: space.md, letterSpacing: 1.6 },
  section: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.lg, marginTop: space.xxl },
  sectionLabel: { marginBottom: space.md },
  lockedHeading: { marginTop: space.xxxl, marginBottom: space.sm },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  lockedText: { flex: 1 },
  lockedTeaser: { marginTop: space.xs + 1 },
  unlock: { marginTop: space.xxxl, borderRadius: radius.lg },
  unlockTitle: { marginTop: space.md },
  unlockSub: { marginTop: space.sm, marginBottom: space.xl },
  errorText: { marginTop: space.md },
  errorActions: { marginTop: space.xxl, alignSelf: "stretch", gap: space.sm },
});
