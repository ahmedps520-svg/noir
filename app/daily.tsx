import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import Shimmer from "../components/Shimmer";
import TopNav from "../components/TopNav";
import Type, { Body, BodySm, Display, H2, Label, Micro } from "../components/Type";
import { color, font, hit, radius, space } from "../constants/theme";
import { useSubscription } from "../context/SubscriptionContext";
import { useDailyHistory, useToday } from "../hooks/useDaily";
import { useDailyReminder } from "../hooks/useDailyReminder";
import { formatDateKey } from "../services/daily";
import { getMoonPhase } from "../services/astronomy";
import { formatReminderTime } from "../services/notifications";
import { successFeedback } from "../services/haptics";

export default function Daily() {
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();
  const { entry, loading, generating, error, reload, submitReflection } = useToday(true);
  const { entries, streak, reload: reloadHistory } = useDailyHistory(30);
  const reminder = useDailyReminder();
  const moon = getMoonPhase();

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Adopt whatever is already stored for today when the entry arrives.
  useEffect(() => {
    if (entry) setDraft(entry.reflection);
  }, [entry]);

  // History is read before today's reading is generated, so on the day a user
  // first opens Today the streak would sit one short until they navigated away
  // and back. Refresh it once today's entry exists.
  useEffect(() => {
    if (entry && !entries.some(item => item.date === entry.date)) reloadHistory();
  }, [entry, entries, reloadHistory]);

  const nav = (
    <View style={styles.navWrap}>
      <TopNav />
    </View>
  );

  const save = async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      await submitReflection(draft);
      successFeedback();
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  if (!subscriptionLoading && !isNoirPlus) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        {nav}
        <View style={styles.center}>
          <Label tone="plus">NOIR+ required</Label>
          <Display center style={styles.lockedTitle}>
            Daily readings are part of NOIR+.
          </Display>
          <BodySm center style={styles.lockedSub}>
            A new reading written for you each day, plus a place to answer it. Not a generic star
            sign.
          </BodySm>
          <View style={styles.actions}>
            <NoirButton label="View NOIR+" plus onPress={() => router.push("/paywall")} />
            <NoirButton label="Back" quiet onPress={() => router.back()} />
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
        <View style={styles.skeleton}>
          <Micro tone="muted" style={styles.loadingText}>
            {generating ? "Writing today's reading" : "Opening today"}
          </Micro>
          <Shimmer lines={4} />
          <View style={styles.skeletonGap} />
          <Shimmer lines={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        {nav}
        <View style={styles.center}>
          <Micro>Today</Micro>
          <Display center style={styles.lockedTitle}>
            Today's reading isn't ready.
          </Display>
          <BodySm tone="danger" center style={styles.lockedSub}>
            {error || "NOIR couldn't compose today's reading."}
          </BodySm>
          <View style={styles.actions}>
            <NoirButton label="Try again" plus onPress={reload} />
            <NoirButton label="Back" quiet onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      {nav}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Reveal>
            <View style={styles.head}>
              <Micro style={styles.kicker}>{formatDateKey(entry.date)}</Micro>
              {streak > 1 && (
                <View style={styles.streak}>
                  <Micro tone="plus">
                    {streak} day{streak === 1 ? "" : "s"} ✦
                  </Micro>
                </View>
              )}
            </View>
            <Display>Today.</Display>
            <Micro tone="dim" style={styles.moon}>
              {moon.glyph}  {entry.moonPhase || moon.name} · {moon.illumination}% illuminated
            </Micro>
          </Reveal>

          <Reveal delay={140}>
            <Section title="Focus" text={entry.focus} />
            <Section title="Relationships" text={entry.relationships} />
            <Section title="Watch for" text={entry.caution} />
          </Reveal>

          {!!entry.prompt && (
            <Reveal delay={240}>
              <Card tone="plus" style={styles.promptCard}>
                <Label tone="plus">Your turn</Label>
                <H2 style={styles.promptText}>{entry.prompt}</H2>

                <TextInput
                  value={draft}
                  onChangeText={text => {
                    setDraft(text);
                    setSaved(false);
                  }}
                  placeholder="Write your answer…"
                  placeholderTextColor={color.textFaint}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Your reflection for today"
                  maxFontSizeMultiplier={1.4}
                  style={styles.input}
                />

                <View style={styles.saveRow}>
                  <BodySm tone={saved ? "plus" : "faint"}>
                    {saved
                      ? "Saved to your journal."
                      : entry.reflectionUpdatedAt
                        ? "Answered today."
                        : "Private to your account."}
                  </BodySm>
                  <Pressable
                    onPress={save}
                    disabled={saving || !draft.trim()}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.saveButton,
                      (saving || !draft.trim()) && styles.saveDisabled,
                      pressed && styles.savePressed,
                    ]}
                  >
                    <Type variant="button" tone="onLight">
                      {saving ? "Saving…" : "Save"}
                    </Type>
                  </Pressable>
                </View>
              </Card>
            </Reveal>
          )}

          {/* Asked here, once, after they have actually read something —
              never at launch, and never again once iOS has been prompted. */}
          {reminder.supported &&
            !reminder.loading &&
            !reminder.preference.enabled &&
            reminder.permission === "undetermined" && (
              <Reveal delay={320}>
                <Card style={styles.reminderPrompt}>
                  <Label>Tomorrow</Label>
                  <Type variant="h2" style={styles.reminderTitle}>
                    Want a nudge when it's ready?
                  </Type>
                  <BodySm tone="muted" style={styles.reminderBody}>
                    One quiet reminder a day, at a time you choose. You can change or turn it off in
                    Settings.
                  </BodySm>
                  <NoirButton
                    label={`Remind me at ${formatReminderTime(
                      reminder.preference.hour,
                      reminder.preference.minute,
                    )}`}
                    plus
                    loading={reminder.busy}
                    disabled={reminder.busy}
                    onPress={() => reminder.toggle(true)}
                  />
                </Card>
              </Reveal>
            )}

          <View style={styles.footer}>
            <NoirButton label="Your journal" onPress={() => router.push("/journal")} />
            <NoirButton label="Open full reading" quiet onPress={() => router.push("/full-reading")} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.giant },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  loadingText: { marginBottom: space.xxl },
  skeleton: { flex: 1, paddingHorizontal: space.xxl, paddingTop: space.xxxl },
  skeletonGap: { height: space.xxl },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { marginBottom: space.sm, letterSpacing: 1.6 },
  streak: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.plusBorder,
    backgroundColor: color.plusSurface,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  moon: { marginTop: space.md, letterSpacing: 1.2 },
  lockedTitle: { marginTop: space.md },
  lockedSub: { marginTop: space.md },
  actions: { marginTop: space.xxxl, alignSelf: "stretch", gap: space.sm },
  section: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.lg, marginTop: space.xxl },
  sectionLabel: { marginBottom: space.md },
  promptCard: { marginTop: space.xxxl },
  promptText: { marginTop: space.md },
  input: {
    minHeight: 120,
    marginTop: space.xl,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.plusBorder,
    backgroundColor: "rgba(0,0,0,0.25)",
    color: color.textHigh,
    padding: space.lg,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: font.body,
  },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.lg,
  },
  saveButton: {
    minHeight: hit.min,
    borderRadius: radius.pill,
    backgroundColor: color.plus,
    paddingHorizontal: space.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  saveDisabled: { opacity: 0.4 },
  savePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  reminderPrompt: { marginTop: space.xxl },
  reminderTitle: { marginTop: space.md },
  reminderBody: { marginTop: space.sm, marginBottom: space.xl },
  footer: { marginTop: space.huge, gap: space.sm },
});
