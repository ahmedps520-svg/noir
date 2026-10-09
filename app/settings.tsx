import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CosmicBackground from "../components/CosmicBackground";
import ReminderControl from "../components/ReminderControl";
import Reveal from "../components/Reveal";
import TopNav from "../components/TopNav";
import Type, { BodySm, Display, Micro } from "../components/Type";
import { color, hit, space } from "../constants/theme";
import { NOIR_LEGAL } from "../constants/config";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { signOutNoir } from "../services/auth";
import { tapFeedback } from "../services/haptics";
import { isEntitlementValid, openManageSubscriptions } from "../services/subscription";

type Row = {
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
};

export default function Settings() {
  const { user } = useAuth();
  const { isNoirPlus, entitlement, restore } = useSubscription();
  const [restoring, setRestoring] = useState(false);

  const onRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restore();
      Alert.alert(
        "NOIR+",
        isEntitlementValid(restored)
          ? "Your NOIR+ subscription has been restored."
          : "No active NOIR+ subscription was found for this Apple ID.",
      );
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

  const rows: Row[] = [
    { label: "Account", detail: user?.email ?? undefined, onPress: () => router.push("/profile") },
    {
      label: "NOIR+",
      detail: isNoirPlus ? (entitlement.plan === "weekly" ? "Weekly" : "Monthly") : "Inactive",
      onPress: () => (isNoirPlus ? openManageSubscriptions() : router.push("/paywall")),
    },
    {
      label: "Restore purchases",
      detail: restoring ? "Restoring..." : undefined,
      onPress: onRestore,
    },
    { label: "Terms of use", onPress: () => Linking.openURL(NOIR_LEGAL.termsUrl) },
  ];

  if (NOIR_LEGAL.privacyUrl) {
    rows.push({ label: "Privacy policy", onPress: () => Linking.openURL(NOIR_LEGAL.privacyUrl) });
  }

  if (NOIR_LEGAL.supportEmail) {
    rows.push({
      label: "Support",
      detail: NOIR_LEGAL.supportEmail,
      onPress: () => Linking.openURL(`mailto:${NOIR_LEGAL.supportEmail}?subject=NOIR%20Support`),
    });
  }

  rows.push({ label: "Sign out", onPress: confirmSignOut, danger: true });
  // Required by App Store Review Guideline 5.1.1(v): deletion must be
  // reachable inside the app, not only via email or a website.
  rows.push({
    label: "Delete account",
    detail: "Permanently erase your profile, readings and journal",
    onPress: () => router.push("/delete-account"),
    danger: true,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.navWrap}>
        <TopNav />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Micro tone="muted">← Back</Micro>
        </Pressable>

        <Reveal>
          <Display style={styles.title}>Settings</Display>
        </Reveal>

        <Reveal delay={80}>
          <ReminderControl entitled={isNoirPlus} />
        </Reveal>

        <View style={styles.sectionGap} />

        <Reveal delay={100}>
          {rows.map(row => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              onPress={() => {
                tapFeedback();
                row.onPress();
              }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Type variant="title" tone={row.danger ? "danger" : "high"}>
                  {row.label}
                </Type>
                {!!row.detail && (
                  <BodySm tone="dim" style={styles.detail}>
                    {row.detail}
                  </BodySm>
                )}
              </View>
              <Type variant="title" tone={row.danger ? "danger" : "faint"}>
                ↗
              </Type>
            </Pressable>
          ))}
        </Reveal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  navWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  container: { padding: space.xxl, paddingBottom: space.giant },
  back: { minHeight: hit.min, justifyContent: "center", marginTop: space.lg },
  title: { marginBottom: space.xl },
  sectionGap: { height: space.xxl },
  row: {
    minHeight: 68,
    borderTopWidth: 1,
    borderTopColor: color.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.lg,
    gap: space.md,
  },
  rowPressed: { backgroundColor: color.surface },
  rowText: { flex: 1 },
  detail: { marginTop: space.xs + 1 },
});
