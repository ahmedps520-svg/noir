import { router } from "expo-router";
import { Animated, StyleSheet, View } from "react-native";
import { useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import Reveal from "../components/Reveal";
import TopNav from "../components/TopNav";
import Type, { Body, BodySm, Display, Label, Micro } from "../components/Type";
import { color, radius, space } from "../constants/theme";
import { useSubscription } from "../context/SubscriptionContext";
import { useNoirProfile, useNoirReading } from "../hooks/useNoirData";
import { useDailyHistory, useToday } from "../hooks/useDaily";
import { formatToday, getMoonPhase } from "../services/astronomy";
import { hasReadingContent } from "../services/reading";

export default function Home() {
  const { isNoirPlus } = useSubscription();
  const { data: profile } = useNoirProfile();
  const { data: fullReading } = useNoirReading("fullReading");
  const { data: previewReading } = useNoirReading("previewReading");

  // Read-only: Home never spends a model call. Opening Today is what generates.
  const { entry: today } = useToday(false);
  const { streak } = useDailyHistory(30);

  const reading = isNoirPlus && hasReadingContent(fullReading) ? fullReading : previewReading;
  const moon = getMoonPhase();

  // Scroll-linked parallax: the celestial scene drifts and fades as the page
  // moves, so the header has depth instead of scrolling as one flat slab.
  const scrollY = useRef(new Animated.Value(0)).current;
  const sceneShift = scrollY.interpolate({ inputRange: [0, 260], outputRange: [0, -46], extrapolate: "clamp" });
  const sceneFade = scrollY.interpolate({ inputRange: [0, 220], outputRange: [1, 0.25], extrapolate: "clamp" });
  const heroLift = scrollY.interpolate({ inputRange: [0, 260], outputRange: [0, 22], extrapolate: "clamp" });

  const firstName = profile?.displayName?.trim().split(" ")[0] ?? "";
  const archetype = reading?.archetype || "Your profile";
  const unread = isNoirPlus && !today;

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.navWrap}>
        <TopNav />
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <Reveal style={styles.hero}>
          <Animated.View style={{ transform: [{ translateY: heroLift }] }}>
            <View style={styles.heroTop}>
              <Micro style={styles.kicker}>{formatToday()}</Micro>
              {streak > 1 && (
                <View style={styles.streak}>
                  <Micro tone="plus">{streak} day streak ✦</Micro>
                </View>
              )}
            </View>
            <Display style={styles.title}>
              {firstName ? `Good to see you, ${firstName}.` : "Your cosmic overview."}
            </Display>
            <BodySm style={styles.sub}>A quick look at what the sky says today.</BodySm>
          </Animated.View>
          <Animated.View style={[styles.scene, { opacity: sceneFade, transform: [{ translateY: sceneShift }] }]}>
            <CelestialScene compact />
          </Animated.View>
        </Reveal>

        <Reveal delay={120}>
          <Card
            tone={unread ? "plus" : "raised"}
            onPress={() => router.push(isNoirPlus ? "/daily" : "/paywall")}
            style={styles.card}
          >
            <View style={styles.cardHead}>
              <View style={[styles.pill, unread && styles.pillUnread]}>
                <Micro tone="onLight" style={styles.pillText}>
                  {unread ? "New today" : "Today"}
                </Micro>
              </View>
              {!!today?.reflection && <Micro tone="plus">Answered ✦</Micro>}
            </View>

            <Type variant="h2" style={styles.cardTitle}>
              {unread ? "Your reading is waiting." : "Your daily reading"}
            </Type>

            <Body tone="muted" numberOfLines={3} style={styles.cardBody}>
              {today?.focus ??
                (isNoirPlus
                  ? "NOIR writes you a new reading each day, and asks you one question."
                  : "A daily outlook written against your own profile, with NOIR+.")}
            </Body>

            <Micro tone={unread ? "plus" : "high"} style={styles.link}>
              {unread ? "Open today ↗" : isNoirPlus ? "Read now ↗" : "See NOIR+ ↗"}
            </Micro>
          </Card>
        </Reveal>

        <Reveal delay={200}>
          <Card
            tone={isNoirPlus ? "plus" : "raised"}
            onPress={() => router.push(isNoirPlus ? "/full-reading" : "/paywall")}
            style={styles.card}
          >
            <View style={styles.cardHead}>
              <Label tone="plus">{isNoirPlus ? "NOIR+ · Unlocked" : "NOIR+"}</Label>
              <Type variant="title" tone="plus">
                ✦
              </Type>
            </View>
            <Type variant="h2" style={styles.cardTitle}>
              {isNoirPlus ? "Your full reading" : "Unlock your full reading"}
            </Type>
            <Body tone="muted" style={styles.cardBody}>
              {isNoirPlus
                ? "Core, relationships, ambition, patterns — the standing read on who you are."
                : "Go deeper into personality, relationships, ambition and your patterns."}
            </Body>
            <Micro tone="plus" style={styles.link}>
              {isNoirPlus ? "Open reading ↗" : "See NOIR+ ↗"}
            </Micro>
          </Card>
        </Reveal>

        <Reveal delay={280} style={styles.grid}>
          <Card onPress={() => router.push("/journal")} style={styles.smallCard}>
            <Label>Journal</Label>
            <Type variant="title" style={styles.smallTitle}>
              {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} running` : "Start your streak"}
            </Type>
            <BodySm tone="dim">Every reading and answer you've kept</BodySm>
            <Micro style={styles.link}>Open ↗</Micro>
          </Card>

          <Card onPress={() => router.push("/sky")} style={styles.smallCard}>
            <Label>Sky</Label>
            <Type variant="title" style={styles.smallTitle}>
              {moon.name}
            </Type>
            <BodySm tone="dim">{moon.illumination}% illuminated</BodySm>
            <Micro style={styles.link}>Explore ↗</Micro>
          </Card>

          <Card onPress={() => router.push("/profile")} style={styles.smallCard}>
            <Label>Profile</Label>
            <Type variant="title" style={styles.smallTitle} numberOfLines={2}>
              {archetype}
            </Type>
            <BodySm tone="dim" numberOfLines={2}>
              {reading?.traits?.length ? reading.traits.join(" · ") : "Your cosmic identity"}
            </BodySm>
            <Micro style={styles.link}>View ↗</Micro>
          </Card>
        </Reveal>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xl, paddingBottom: space.huge },
  hero: { minHeight: 250, justifyContent: "center", position: "relative" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  kicker: { letterSpacing: 1.6 },
  streak: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.plusBorder,
    backgroundColor: color.plusSurface,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  title: { marginTop: space.sm, maxWidth: 290 },
  sub: { marginTop: space.md, maxWidth: 240 },
  scene: { position: "absolute", right: -70, top: 16, width: 230, height: 230 },
  card: { marginBottom: space.md, borderRadius: radius.lg },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: {
    paddingHorizontal: space.md,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: color.textHigh,
    justifyContent: "center",
  },
  pillUnread: { backgroundColor: color.plus },
  pillText: { letterSpacing: 0.8 },
  cardTitle: { marginTop: space.md },
  cardBody: { marginTop: space.sm },
  link: { marginTop: space.lg, letterSpacing: 1.2 },
  grid: { gap: space.md },
  smallCard: { minHeight: 150, borderRadius: radius.md },
  smallTitle: { marginTop: space.md, marginBottom: space.xs },
});
