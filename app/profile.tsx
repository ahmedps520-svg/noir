import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import ChartSignature from "../components/ChartSignature";
import CosmicBackground from "../components/CosmicBackground";
import CelestialScene from "../components/CelestialScene";
import Reveal from "../components/Reveal";
import TopNav from "../components/TopNav";
import Type, { Body, BodySm, H1, Label, Micro } from "../components/Type";
import { color, hit, space } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useNatalChart, useNoirProfile, useNoirReading } from "../hooks/useNoirData";
import { signOutNoir } from "../services/auth";
import { hasReadingContent } from "../services/reading";
import { openManageSubscriptions } from "../services/subscription";

const READING_SECTIONS = [
  ["Personality", "Your deeper patterns and tendencies"],
  ["Relationships", "Connection, trust and communication"],
  ["Ambition", "Motivation, direction and drive"],
  ["Cosmic profile", "Your complete birth-based interpretation"],
];

function formatRenewal(expiresAt: number | null) {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Profile() {
  const { user } = useAuth();
  const { isNoirPlus, entitlement, restore } = useSubscription();
  const { data: profile } = useNoirProfile();
  const { chart } = useNatalChart();
  const { data: fullReading } = useNoirReading("fullReading");
  const { data: previewReading } = useNoirReading("previewReading");
  const [restoring, setRestoring] = useState(false);

  const reading = isNoirPlus && hasReadingContent(fullReading) ? fullReading : previewReading;
  const renewal = formatRenewal(entitlement.expiresAt);
  const providerId = user?.providerData?.[0]?.providerId ?? "password";
  const providerLabel =
    providerId === "apple.com" ? "Apple" : providerId === "google.com" ? "Google" : "Email";

  const onRestore = async () => {
    setRestoring(true);
    try {
      await restore();
    } catch (e) {
      Alert.alert("NOIR+", (e as Error)?.message || "Purchases could not be restored.");
    } finally {
      setRestoring(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out of NOIR?", "Your profile and reading stay saved to your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOutNoir();
            router.replace("/");
          } catch (e) {
            Alert.alert("NOIR", (e as Error)?.message || "Could not sign out.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.navWrap}>
        <TopNav />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Reveal>
          <Micro style={styles.kicker}>Your NOIR</Micro>
          <H1 style={styles.archetype}>{reading?.archetype || "Your profile"}</H1>
          {!!reading?.traits?.length && (
            <Micro tone="muted" style={styles.traits}>
              {reading.traits.join("   ·   ")}
            </Micro>
          )}
          <ChartSignature chart={chart} />
        </Reveal>

        <CelestialScene compact />

        <Reveal delay={120}>
          <Label style={styles.sectionLabel}>Account</Label>
          <Card padded={false} style={styles.infoCard}>
            <InfoRow label="Name" value={profile?.displayName || "—"} />
            <InfoRow label="Email" value={user?.email || profile?.email || "—"} />
            <InfoRow label="Sign-in" value={providerLabel} />
            <InfoRow
              label="Born"
              value={
                profile?.birthDate
                  ? `${profile.birthDate} · ${profile.birthTime} · ${profile.birthPlace}`
                  : "—"
              }
              last
            />
          </Card>
        </Reveal>

        <Reveal delay={200}>
          <Label style={styles.sectionLabel}>Subscription</Label>
          <Card tone={isNoirPlus ? "plus" : "default"}>
            <View style={styles.statusHead}>
              <Type variant="title" tone={isNoirPlus ? "plus" : "muted"}>
                {isNoirPlus ? "NOIR+ active" : "NOIR+ inactive"}
              </Type>
              <Type variant="title" tone={isNoirPlus ? "plus" : "faint"}>
                {isNoirPlus ? "✦" : "⌁"}
              </Type>
            </View>

            <BodySm tone="muted" style={styles.statusBody}>
              {isNoirPlus
                ? entitlement.plan === "weekly"
                  ? "Weekly plan."
                  : "Monthly plan."
                : "Your full reading is locked until NOIR+ is active."}
              {isNoirPlus && renewal
                ? entitlement.autoRenewing
                  ? ` Renews ${renewal}.`
                  : ` Access ends ${renewal}.`
                : ""}
            </BodySm>

            {entitlement.source === "dev-mock" && (
              <BodySm tone="plus" style={styles.devWarning}>
                ⚠︎ Simulated dev entitlement — not an Apple purchase.
              </BodySm>
            )}

            <View style={styles.statusActions}>
              {isNoirPlus ? (
                <>
                  <ActionLink label="Open full reading ↗" onPress={() => router.push("/full-reading")} />
                  <ActionLink label="Manage subscription" quiet onPress={openManageSubscriptions} />
                </>
              ) : (
                <>
                  <ActionLink label="View NOIR+ ↗" onPress={() => router.push("/paywall")} />
                  <ActionLink
                    label={restoring ? "Restoring..." : "Restore purchases"}
                    quiet
                    onPress={onRestore}
                  />
                </>
              )}
            </View>
          </Card>
        </Reveal>

        <Reveal delay={280}>
          <Label style={styles.sectionLabel}>Your reading</Label>
          {READING_SECTIONS.map(([name, description]) => (
            <Card
              key={name}
              onPress={() => router.push(isNoirPlus ? "/full-reading" : "/paywall")}
              style={styles.row}
            >
              <View style={styles.rowInner}>
                <View style={styles.rowText}>
                  <Type variant="title">{name}</Type>
                  <BodySm tone="dim" style={styles.desc}>
                    {description}
                  </BodySm>
                </View>
                <Micro tone={isNoirPlus ? "high" : "plus"}>{isNoirPlus ? "Open ↗" : "NOIR+"}</Micro>
              </View>
            </Card>
          ))}
        </Reveal>

        <Pressable onPress={() => router.push("/settings")} style={styles.footerLink} accessibilityRole="button">
          <Body>Settings ↗</Body>
        </Pressable>

        <Pressable onPress={confirmSignOut} style={styles.footerLink} accessibilityRole="button">
          <Body tone="danger">Sign out</Body>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionLink({
  label,
  onPress,
  quiet,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.actionRow} hitSlop={6}>
      <BodySm tone={quiet ? "muted" : "high"}>{label}</BodySm>
    </Pressable>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Micro tone="faint">{label}</Micro>
      <Body style={styles.infoValue} numberOfLines={2}>
        {value}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.giant },
  kicker: { marginTop: space.xl, marginBottom: space.sm },
  archetype: { fontSize: 38, lineHeight: 44 },
  traits: { marginTop: space.md, letterSpacing: 1.6 },
  sectionLabel: { marginTop: space.xxxl, marginBottom: space.md },
  infoCard: { paddingHorizontal: space.xl },
  infoRow: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: color.border },
  infoRowLast: { borderBottomWidth: 0 },
  infoValue: { marginTop: space.xs + 2 },
  statusHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBody: { marginTop: space.md },
  devWarning: { marginTop: space.md },
  statusActions: { marginTop: space.md },
  actionRow: { minHeight: hit.min, justifyContent: "center" },
  row: { marginBottom: space.sm },
  rowInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  rowText: { flex: 1 },
  desc: { marginTop: space.xs + 1 },
  footerLink: { minHeight: hit.comfortable, justifyContent: "center", marginTop: space.lg },
});
