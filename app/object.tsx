import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import Reveal from "../components/Reveal";
import TopNav from "../components/TopNav";
import Type, { Body, BodySm, Hero, Label, Micro } from "../components/Type";
import { color, hit, space } from "../constants/theme";
import { bodyDetail, formatEventDate, SKY_BODIES } from "../services/astronomy";
import { SIGN_GLYPH, type PointName } from "../services/chart";

/** What each body stands for in a chart, and one true thing about it. */
const ABOUT: Record<string, { meaning: string; fact: string }> = {
  Sun: {
    meaning: "Your core self — what you're building, and what you need in order to feel like yourself.",
    fact: "Light from the Sun takes about 8 minutes 20 seconds to reach Earth.",
  },
  Moon: {
    meaning: "Your inner life — instinct, comfort, and how you respond before you think.",
    fact: "The Moon moves through a whole sign roughly every two and a half days.",
  },
  Mercury: {
    meaning: "How you think, speak and decide — your mind's natural pace.",
    fact: "Mercury appears to move backwards three or four times a year, for about three weeks each time.",
  },
  Venus: {
    meaning: "What you value and how you love — taste, attraction and affection.",
    fact: "After the Moon, Venus is the brightest natural object in the night sky.",
  },
  Mars: {
    meaning: "How you act and compete — drive, anger and where you push.",
    fact: "Mars turns retrograde about every 26 months, its longest gap of any planet.",
  },
  Jupiter: {
    meaning: "Where you grow — luck, generosity and the urge to expand.",
    fact: "Jupiter spends about a year in each sign, circling the zodiac in roughly 12 years.",
  },
  Saturn: {
    meaning: "Where you're tested — discipline, limits and what you build to last.",
    fact: "Saturn takes about 29.5 years to circle the zodiac — the root of the 'Saturn return'.",
  },
  Uranus: {
    meaning: "Where you break pattern — independence, disruption and sudden change.",
    fact: "Uranus spends about seven years in each sign.",
  },
  Neptune: {
    meaning: "Where you dream — imagination, ideals and what dissolves boundaries.",
    fact: "Neptune takes about 165 years to circle the zodiac, so it is in a sign for 14 years.",
  },
  Pluto: {
    meaning: "Where you transform — power, depth and what has to end so something can begin.",
    fact: "Pluto can stay in one sign for more than 20 years.",
  },
};

function formatDistance(au: number, point: string) {
  const km = au * 149_597_870.7;
  if (point === "Moon") return `${Math.round(km).toLocaleString()} km`;
  if (km < 1e9) return `${(km / 1e6).toFixed(1)} million km`;
  return `${(km / 1e9).toFixed(2)} billion km`;
}

export default function ObjectPage() {
  const { name } = useLocalSearchParams();
  const requested = String(name ?? "Moon");
  // Accept older links that used uppercase names ("JUPITER").
  const point = (SKY_BODIES.find(b => b.toLowerCase() === requested.toLowerCase()) ?? "Moon") as PointName;

  const detail = useMemo(() => bodyDetail(point, new Date()), [point]);
  const { placement } = detail;
  const about = ABOUT[point];

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.navWrap}>
        <TopNav />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Micro tone="muted">← Sky</Micro>
        </Pressable>

        <Reveal>
          <Micro style={styles.kicker}>Right now</Micro>
          <Hero style={styles.title}>{point}</Hero>
          <View style={styles.position}>
            <Type variant="h2" tone="plus">
              {SIGN_GLYPH[placement.sign]}
            </Type>
            <Type variant="h2">
              {placement.degree}°{String(placement.minute).padStart(2, "0")}′ {placement.sign}
            </Type>
          </View>
          {placement.retrograde && (
            <Micro tone="plus" style={styles.retro}>
              Retrograde — appearing to move backwards
            </Micro>
          )}
        </Reveal>

        <CelestialScene compact />

        <Reveal delay={120}>
          <Card style={styles.card}>
            <Fact label="Distance from Earth" value={formatDistance(detail.distanceAu, point)} />
            {detail.magnitude !== null && (
              <Fact
                label="Brightness"
                value={`Magnitude ${detail.magnitude.toFixed(1)}${detail.magnitude <= 6 ? " · naked eye" : " · telescope"}`}
              />
            )}
            <Fact
              label="Next sign"
              value={
                detail.nextIngress
                  ? `${detail.nextIngress.sign} · ${formatEventDate(detail.nextIngress.date)}`
                  : `Stays in ${placement.sign} beyond the next year`
              }
              last={!detail.nextStation}
            />
            {detail.nextStation && (
              <Fact
                label={detail.nextStation.becomes === "retrograde" ? "Turns retrograde" : "Turns direct"}
                value={formatEventDate(detail.nextStation.date)}
                last
              />
            )}
          </Card>
        </Reveal>

        {about && (
          <Reveal delay={200}>
            <Label style={styles.sectionLabel}>In your chart</Label>
            <Body tone="muted">{about.meaning}</Body>
            <Label style={styles.sectionLabel}>In the sky</Label>
            <Body tone="muted">{about.fact}</Body>
          </Reveal>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <Micro tone="faint">{label}</Micro>
      <Type variant="title" style={styles.factValue}>
        {value}
      </Type>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.giant },
  back: { minHeight: hit.min, justifyContent: "center", marginTop: space.md },
  kicker: { marginTop: space.lg },
  title: { marginTop: space.sm, fontSize: 54, lineHeight: 60, letterSpacing: 0 },
  position: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  retro: { marginTop: space.sm },
  card: { paddingVertical: space.xs },
  fact: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  factLast: { borderBottomWidth: 0 },
  factValue: { marginTop: space.xs },
  sectionLabel: { marginTop: space.xxl, marginBottom: space.sm },
});
