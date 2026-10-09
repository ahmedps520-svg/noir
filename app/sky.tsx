import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import Reveal from "../components/Reveal";
import TopNav from "../components/TopNav";
import Type, { BodySm, Hero, Label, Micro } from "../components/Type";
import { color, radius, space } from "../constants/theme";
import {
  currentSky,
  formatEventDate,
  formatToday,
  getMoonPhase,
  upcomingEvents,
  type SkyEvent,
} from "../services/astronomy";
import { SIGN_GLYPH } from "../services/chart";

const EVENT_MARK: Record<SkyEvent["kind"], string> = {
  moon: "☽",
  eclipse: "◐",
  season: "☉",
  station: "℞",
  meteors: "✦",
};

/**
 * The sky right now. Every value is computed for this moment — there is no
 * static content left to go stale. Positions are geocentric, which is the frame
 * astrology uses and means nothing depends on the person's location.
 */
export default function Sky() {
  // Computed once per visit: positions move too slowly to need a live clock.
  const { moon, planets, events } = useMemo(() => {
    const now = new Date();
    return {
      moon: getMoonPhase(now),
      planets: currentSky(now).filter(p => p.point !== "Moon"),
      events: upcomingEvents(now, 6),
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.navWrap}>
        <TopNav />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Reveal>
          <Micro style={styles.meta}>{formatToday()}</Micro>
          <Hero style={styles.title}>Look up.</Hero>
          <Micro tone="muted" style={styles.sub}>
            The sky, right now
          </Micro>
        </Reveal>

        <CelestialScene />

        <Reveal delay={120}>
          <Card onPress={() => router.push({ pathname: "/object", params: { name: "Moon" } })} style={styles.moonCard}>
            <View style={styles.moonText}>
              <Label>The Moon</Label>
              <Type variant="h2" style={styles.phase}>
                {moon.name}
              </Type>
              <BodySm tone="dim">
                In {moon.sign} · {moon.illumination}% lit · day {Math.floor(moon.age)} of the cycle
              </BodySm>
            </View>
            <Type variant="hero" style={styles.moonGlyph}>
              {moon.glyph}
            </Type>
          </Card>
        </Reveal>

        <Reveal delay={200}>
          <Label style={styles.sectionLabel}>Where the planets are</Label>
          {planets.map(p => (
            <Card
              key={p.point}
              onPress={() => router.push({ pathname: "/object", params: { name: p.point } })}
              style={styles.planet}
            >
              <View style={styles.planetInner}>
                <Type variant="title" tone="plus" style={styles.signGlyph}>
                  {SIGN_GLYPH[p.sign]}
                </Type>
                <View style={styles.planetText}>
                  <Type variant="title">{p.point}</Type>
                  <BodySm tone="dim">
                    {p.degree}° {p.sign}
                  </BodySm>
                </View>
                {p.retrograde && (
                  <View style={styles.badge}>
                    <Micro tone="plus">Retrograde</Micro>
                  </View>
                )}
              </View>
            </Card>
          ))}
        </Reveal>

        <Reveal delay={280}>
          <Label style={styles.sectionLabel}>Coming up</Label>
          {events.map(event => (
            <View key={`${event.title}-${event.date.getTime()}`} style={styles.event}>
              <Type variant="title" tone="plus" style={styles.eventMark}>
                {EVENT_MARK[event.kind]}
              </Type>
              <View style={styles.eventText}>
                <Micro tone="muted">{formatEventDate(event.date)}</Micro>
                <Type variant="title" style={styles.eventTitle}>
                  {event.title}
                </Type>
                <BodySm tone="dim">{event.detail}</BodySm>
              </View>
            </View>
          ))}
          <BodySm tone="faint" style={styles.note}>
            Positions are calculated for this moment, as seen from Earth.
          </BodySm>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.huge },
  meta: { marginTop: space.xl },
  title: { marginTop: space.md, fontSize: 58, lineHeight: 64, letterSpacing: 0 },
  sub: { marginTop: space.sm, letterSpacing: 1.6 },
  moonCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.lg },
  moonText: { flex: 1 },
  phase: { marginTop: space.sm, marginBottom: space.xs },
  moonGlyph: { fontSize: 52, lineHeight: 60 },
  sectionLabel: { marginTop: space.xxxl, marginBottom: space.md },
  planet: { marginBottom: space.sm, borderRadius: radius.md },
  planetInner: { flexDirection: "row", alignItems: "center", gap: space.md },
  signGlyph: { width: 28, textAlign: "center" },
  planetText: { flex: 1 },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.plusBorder,
    backgroundColor: color.plusSurface,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  event: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  eventMark: { width: 28, textAlign: "center", marginTop: space.lg },
  eventText: { flex: 1 },
  eventTitle: { marginTop: space.xs, marginBottom: space.xs },
  note: { marginTop: space.lg },
});
