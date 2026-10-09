import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ChartSignature from "../components/ChartSignature";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import Shimmer from "../components/Shimmer";
import TopNav from "../components/TopNav";
import Type, { Body, BodySm, Display, H1, Label, Micro } from "../components/Type";
import { NOIR_LEGAL } from "../constants/config";
import { color, space } from "../constants/theme";
import { useSubscription } from "../context/SubscriptionContext";
import { useNatalChart, useNoirReading } from "../hooks/useNoirData";
import {
  generateReading,
  getSavedProfile,
  hasReadingContent,
  type NoirReading,
} from "../services/reading";

export default function FullReading() {
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();
  const { data: saved, loading, error, reload } = useNoirReading("fullReading");
  // Held locally the moment it is written, so the screen never waits on a
  // re-fetch (or flashes an empty state) between writing and showing it.
  const [fresh, setFresh] = useState<NoirReading | null>(null);
  const reading = fresh ?? saved;
  const { chart } = useNatalChart();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const autoStarted = useRef(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    setGenerateError("");
    setProfileMissing(false);
    try {
      const profile = await getSavedProfile();
      if (!profile || !profile.birthDate) {
        setProfileMissing(true);
        throw new Error("NOIR couldn't find your birth details, so it can't write your reading yet.");
      }
      const written = await generateReading(profile, true);
      if (!hasReadingContent(written)) {
        throw new Error("Your reading came back empty. Please try again.");
      }
      setFresh(written);
      reload();
    } catch (e) {
      setGenerateError((e as Error)?.message || "Your reading could not be written.");
    } finally {
      setGenerating(false);
    }
  }, [reload]);

  // Someone who has paid should never have to press a button to get the thing
  // they paid for. If NOIR+ is active and no full reading exists yet — the
  // celebration screen failed, or they arrived another way — start writing it.
  const needsReading =
    !subscriptionLoading && isNoirPlus && !loading && !error && !hasReadingContent(reading);
  useEffect(() => {
    if (!needsReading || autoStarted.current) return;
    autoStarted.current = true;
    generate();
  }, [needsReading, generate]);

  // The paid product stays locked whenever the entitlement is not currently
  // valid — including a lapsed or cancelled subscription.
  if (!subscriptionLoading && !isNoirPlus) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.navWrap}>
          <TopNav />
        </View>
        <View style={styles.center}>
          <Label tone="plus">NOIR+ required</Label>
          <Display center style={styles.lockedTitle}>
            Your full reading is locked.
          </Display>
          <BodySm center style={styles.lockedSub}>
            NOIR+ isn't active on this account right now. Restore or resubscribe to open your
            complete reading again — it is still here, waiting.
          </BodySm>
          <View style={styles.actions}>
            <NoirButton label="View NOIR+" plus onPress={() => router.push("/paywall")} />
            <NoirButton label="Back to NOIR" quiet onPress={() => router.replace("/home")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (subscriptionLoading || (loading && !fresh)) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.skeleton}>
          <Micro tone="muted" style={styles.loadingText}>Opening your reading</Micro>
          <Shimmer lines={4} />
          <View style={styles.skeletonGap} />
          <Shimmer lines={4} />
        </View>
      </SafeAreaView>
    );
  }

  const failure = generateError || (fresh ? "" : error);

  if (!hasReadingContent(reading) && !failure) {
    // Writing — either in progress, or about to start on this render.
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.skeleton}>
          <Micro tone="plus">NOIR+ / Full reading</Micro>
          <Display style={styles.writingTitle}>Writing your reading…</Display>
          <BodySm tone="muted" style={styles.writingSub}>
            NOIR is reading your chart and your answers together. This takes about half a minute,
            and it's saved to your account once it's done.
          </BodySm>
          <Shimmer lines={4} />
          <View style={styles.skeletonGap} />
          <Shimmer lines={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasReadingContent(reading)) {
    // Every failure gets a way forward: fix what's missing, retry, or get help.
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.navWrap}>
          <TopNav />
        </View>
        <View style={styles.center}>
          <Micro tone="plus">NOIR+ is active</Micro>
          <Display center style={styles.lockedTitle}>
            {profileMissing ? "NOIR needs your birth details." : "Your reading didn't finish."}
          </Display>
          <BodySm tone="danger" center style={styles.error}>
            {failure}
          </BodySm>
          <BodySm tone="dim" center style={styles.lockedSub}>
            Your subscription is safe and nothing extra has been charged.
          </BodySm>
          <View style={styles.actions}>
            {profileMissing ? (
              <NoirButton label="Add my birth details" plus onPress={() => router.replace("/onboarding")} />
            ) : (
              <NoirButton
                label={generating ? "Writing your reading" : "Try again"}
                plus
                loading={generating}
                disabled={generating}
                onPress={generateError ? generate : reload}
              />
            )}
            <NoirButton label="Get help" quiet onPress={() => Linking.openURL(NOIR_LEGAL.supportUrl)} />
            <NoirButton label="Back to NOIR" quiet onPress={() => router.replace("/home")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.navWrap}>
        <TopNav />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Reveal>
          <Micro tone="plus" style={styles.kicker}>
            NOIR+ / Full reading
          </Micro>
          <H1 style={styles.archetype}>{reading.archetype}</H1>
          {reading.traits.length > 0 && (
            <Micro tone="muted" style={styles.traits}>
              {reading.traits.join("   ·   ")}
            </Micro>
          )}
          <ChartSignature chart={chart} />
        </Reveal>

        <CelestialScene compact />

        <Reveal delay={120}>
          <Section title="Your core" text={reading.core} />
          <Section title="Relationships" text={reading.relationships} />
          <Section title="Ambition" text={reading.ambition} />
          <Section title="Your patterns" text={reading.reflection} />
          <Section title="Today" text={reading.daily} />
        </Reveal>

        {(reading.strengths.length > 0 || reading.blindSpots.length > 0) && (
          <Reveal delay={220}>
            {reading.strengths.length > 0 && (
              <ListSection title="Your strengths" items={reading.strengths} marker="✦" />
            )}
            {reading.blindSpots.length > 0 && (
              <ListSection title="Your blind spots" items={reading.blindSpots} marker="◦" />
            )}
          </Reveal>
        )}

        <View style={styles.footerActions}>
          <NoirButton label="Back to NOIR" onPress={() => router.replace("/home")} />
          <NoirButton
            label={generating ? "Regenerating" : "Regenerate my reading"}
            quiet
            loading={generating}
            disabled={generating}
            onPress={generate}
          />
          {!!generateError && (
            <BodySm tone="danger" center style={styles.error}>
              {generateError}
            </BodySm>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <View style={styles.section}>
      <Label style={styles.sectionLabel}>{title}</Label>
      <Body>{text}</Body>
    </View>
  );
}

function ListSection({ title, items, marker }: { title: string; items: string[]; marker: string }) {
  return (
    <View style={styles.section}>
      <Label style={styles.sectionLabel}>{title}</Label>
      {items.map(item => (
        <View key={item} style={styles.listRow}>
          <Type variant="body" tone="plus" style={styles.marker}>
            {marker}
          </Type>
          <Body style={styles.listText}>{item}</Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.giant },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space.xxl },
  loadingText: { marginBottom: space.xxl },
  skeleton: { flex: 1, paddingHorizontal: space.xxl, paddingTop: space.xxxl },
  skeletonGap: { height: space.xxl },
  kicker: { marginBottom: space.sm },
  archetype: { fontSize: 40, lineHeight: 46 },
  traits: { marginTop: space.md, letterSpacing: 1.6 },
  lockedTitle: { marginTop: space.md },
  lockedSub: { marginTop: space.md },
  actions: { marginTop: space.xxxl, alignSelf: "stretch", gap: space.sm },
  section: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.lg, marginTop: space.xxl },
  sectionLabel: { marginBottom: space.md },
  listRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  marker: { lineHeight: 26 },
  listText: { flex: 1 },
  error: { marginTop: space.md },
  writingTitle: { marginTop: space.md },
  writingSub: { marginTop: space.md, marginBottom: space.xxxl, maxWidth: 340 },
  footerActions: { marginTop: space.huge, gap: space.sm },
});
