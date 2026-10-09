import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedNumber from "../components/AnimatedNumber";
import Card from "../components/Card";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import TopNav from "../components/TopNav";
import Type, { Body, BodySm, Display, Label, Micro } from "../components/Type";
import { color, radius, space } from "../constants/theme";
import { useSubscription } from "../context/SubscriptionContext";
import { useDailyHistory } from "../hooks/useDaily";
import { dateKey, formatDateKey, type DailyEntry } from "../services/daily";

/**
 * Everything the user has been given and everything they wrote back, in one
 * place. This is the part that accumulates — the reason the subscription is
 * worth keeping past month one.
 */
export default function Journal() {
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();
  const { entries, streak, loading, error } = useDailyHistory(60);

  const nav = (
    <View style={styles.navWrap}>
      <TopNav />
    </View>
  );

  if (!subscriptionLoading && !isNoirPlus) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        {nav}
        <View style={styles.center}>
          <Label tone="plus">NOIR+ required</Label>
          <Display center style={styles.emptyTitle}>
            Your journal is part of NOIR+.
          </Display>
          <BodySm center style={styles.emptySub}>
            Every daily reading and everything you write back is kept here.
          </BodySm>
          <View style={styles.actions}>
            <NoirButton label="View NOIR+" plus onPress={() => router.push("/paywall")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (subscriptionLoading || loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        {nav}
        <View style={styles.center}>
          <ActivityIndicator color={color.textDim} size="small" />
          <Micro tone="muted" style={styles.loadingText}>
            Opening your journal
          </Micro>
        </View>
      </SafeAreaView>
    );
  }

  const answered = entries.filter(entry => entry.reflection).length;
  const today = dateKey();

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      {nav}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Reveal>
          <Micro style={styles.kicker}>NOIR+ / Journal</Micro>
          <Display>Your journal.</Display>
        </Reveal>

        <Reveal delay={100}>
          <View style={styles.stats}>
            <Stat value={entries.length} label={entries.length === 1 ? "Day" : "Days"} />
            <Stat value={streak} label="Streak" accent />
            <Stat value={answered} label="Answered" />
          </View>
        </Reveal>

        {!!error && (
          <BodySm tone="danger" style={styles.error}>
            {error}
          </BodySm>
        )}

        {entries.length === 0 ? (
          <Reveal delay={160}>
            <Card style={styles.empty}>
              <Label>Nothing here yet</Label>
              <Type variant="h2" style={styles.emptyHeading}>
                Open today's reading.
              </Type>
              <BodySm tone="muted" style={styles.emptyBody}>
                Each day NOIR writes you a new reading and asks you one question. Your answers
                collect here.
              </BodySm>
              <NoirButton label="Open today" plus onPress={() => router.push("/daily")} />
            </Card>
          </Reveal>
        ) : (
          <View>
            {entries.map((entry, i) => (
              <Reveal key={entry.date} delay={160 + i * 60} distance={14}>
                <EntryCard entry={entry} isToday={entry.date === today} />
              </Reveal>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <AnimatedNumber value={value} tone={accent ? "plus" : "high"} style={styles.statValue} />
      <Micro tone="muted">{label}</Micro>
    </View>
  );
}

function EntryCard({ entry, isToday }: { entry: DailyEntry; isToday: boolean }) {
  return (
    <Card
      tone={isToday ? "plus" : "default"}
      onPress={isToday ? () => router.push("/daily") : undefined}
      style={styles.entry}
    >
      <View style={styles.entryHead}>
        <Label tone={isToday ? "plus" : "muted"}>
          {isToday ? "Today" : formatDateKey(entry.date)}
        </Label>
        <Micro tone="faint">{entry.moonPhase}</Micro>
      </View>

      <Body style={styles.entryFocus} numberOfLines={4}>
        {entry.focus}
      </Body>

      {!!entry.reflection && (
        <View style={styles.reflection}>
          <Micro tone="faint" style={styles.reflectionLabel}>
            You wrote
          </Micro>
          <Body tone="muted" style={styles.reflectionText}>
            {entry.reflection}
          </Body>
        </View>
      )}

      {!entry.reflection && !!entry.prompt && (
        <BodySm tone="faint" style={styles.unanswered}>
          Unanswered: {entry.prompt}
        </BodySm>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.giant },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  loadingText: { marginTop: space.lg },
  kicker: { marginBottom: space.sm },
  stats: { flexDirection: "row", gap: space.md, marginTop: space.xxl },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingVertical: space.lg,
    alignItems: "center",
  },
  statValue: { fontSize: 34, lineHeight: 40 },
  error: { marginTop: space.lg },
  empty: { marginTop: space.xxl },
  emptyTitle: { marginTop: space.md },
  emptySub: { marginTop: space.md },
  emptyHeading: { marginTop: space.md },
  emptyBody: { marginTop: space.sm, marginBottom: space.xl },
  actions: { marginTop: space.xxxl, alignSelf: "stretch" },
  entry: { marginTop: space.md },
  entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  entryFocus: { marginTop: space.md },
  reflection: {
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  reflectionLabel: { marginBottom: space.sm },
  reflectionText: { fontStyle: "italic" },
  unanswered: { marginTop: space.md },
});
