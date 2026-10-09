import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../components/Card";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import { ShimmerBar } from "../components/Shimmer";
import Type, { Body, BodySm, Display, Label, Micro } from "../components/Type";
import { color, hit, radius, space } from "../constants/theme";
import { DEV_MOCK_PURCHASE_ENABLED, IS_PREVIEW_BUILD, NOIR_LEGAL } from "../constants/config";
import { useSubscription } from "../context/SubscriptionContext";
import { errorFeedback, tapFeedback } from "../services/haptics";
import {
  SubscriptionCancelledError,
  fetchNoirPlusOffers,
  grantDevMockEntitlement,
  isEntitlementValid,
  purchaseNoirPlus,
  type NoirPlan,
  type NoirPlusOffer,
} from "../services/subscription";

const FEATURES = [
  ["Full personality", "The complete read on how you actually operate."],
  ["Relationships", "Trust, distance and how you let people in."],
  ["Ambition", "What drives you, and what quietly drains you."],
  ["Your patterns", "The loops you repeat, named plainly."],
  ["Daily readings", "A daily outlook written against your profile."],
];

export default function Paywall() {
  const { applyEntitlement, restore } = useSubscription();
  const [offers, setOffers] = useState<NoirPlusOffer[]>([]);
  const [plan, setPlan] = useState<NoirPlan>("monthly");
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchNoirPlusOffers()
      .then(result => {
        if (alive) setOffers(result);
      })
      .finally(() => {
        if (alive) setLoadingOffers(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selected = offers.find(offer => offer.plan === plan) ?? offers[0] ?? null;
  const storeReady = Boolean(selected?.fromStore);

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const entitlement = await purchaseNoirPlus(selected.productId);

      if (!isEntitlementValid(entitlement)) {
        throw new Error("NOIR+ could not be activated. Please try again.");
      }

      applyEntitlement(entitlement);
      router.replace("/premium-success");
    } catch (e) {
      if (e instanceof SubscriptionCancelledError) {
        setBusy(false);
        return;
      }
      errorFeedback();
      setError((e as Error)?.message || "The purchase could not be completed.");
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setRestoring(true);
    setError("");
    try {
      const entitlement = await restore();
      if (isEntitlementValid(entitlement)) {
        router.replace("/premium-success");
        return;
      }
      setError("No active NOIR+ subscription was found for this Apple ID.");
    } catch (e) {
      setError((e as Error)?.message || "Purchases could not be restored.");
    } finally {
      setRestoring(false);
    }
  };

  const devMockPurchase = async () => {
    try {
      const entitlement = await grantDevMockEntitlement(plan);
      applyEntitlement(entitlement);
      router.replace("/premium-success");
    } catch (e) {
      setError((e as Error)?.message || "Simulated purchase failed.");
    }
  };

  const ctaLabel = selected?.hasFreeTrial
    ? `Start ${selected.trialLabel ?? "free trial"}`
    : "Subscribe to NOIR+";

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {IS_PREVIEW_BUILD && (
          <View style={styles.previewBanner}>
            <BodySm style={{ color: color.notice }}>
              UI preview build — purchases here are simulated and no payment is taken. Prices
              are placeholders; on iPhone they come from the App Store in your own currency.
            </BodySm>
          </View>
        )}

        <Reveal>
          <View style={styles.head}>
            <Label tone="plus">NOIR+</Label>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityRole="button">
              <Micro tone="muted">Not now</Micro>
            </Pressable>
          </View>
          <Display style={styles.title}>There's more to you.</Display>
          <Body tone="muted" style={styles.sub}>
            A deeper reading, built around you.
          </Body>
        </Reveal>

        <View style={styles.list}>
          {/* Staggered so the list assembles itself rather than appearing as a
              single block — the feature set reads one item at a time. */}
          {FEATURES.map(([name, desc], i) => (
            <Reveal key={name} delay={140 + i * 70} distance={12}>
              <View style={styles.row}>
                <Micro tone="faint" style={styles.num}>
                  {String(i + 1).padStart(2, "0")}
                </Micro>
                <View style={styles.rowText}>
                  <Type variant="title">{name}</Type>
                  <BodySm tone="dim" style={styles.desc}>
                    {desc}
                  </BodySm>
                </View>
              </View>
            </Reveal>
          ))}
        </View>

        <Reveal delay={240}>
          {loadingOffers ? (
            <View style={styles.offersLoading}>
              <ActivityIndicator color={color.textDim} size="small" />
              <Micro tone="muted" style={styles.offersLoadingText}>
                Loading plans
              </Micro>
            </View>
          ) : (
            <View style={styles.plans}>
              {offers.map(offer => {
                const active = offer.plan === plan;
                return (
                  <Pressable
                    key={offer.productId}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tapFeedback();
                      setPlan(offer.plan);
                    }}
                    style={[styles.plan, active && styles.planActive]}
                  >
                    <View style={styles.planTop}>
                      <Label tone={active ? "onLight" : "muted"}>
                        {offer.plan === "monthly" ? "Monthly" : "Weekly"}
                      </Label>
                      {offer.plan === "monthly" && (
                        <View style={[styles.badge, active && styles.badgeActive]}>
                          <Micro tone={active ? "onLight" : "plus"} style={styles.badgeText}>
                            Best value
                          </Micro>
                        </View>
                      )}
                    </View>

                    <View style={styles.priceRow}>
                      {offer.displayPrice ? (
                        <Type variant="display" tone={active ? "onLight" : "high"} style={styles.planPrice}>
                          {offer.displayPrice}
                        </Type>
                      ) : (
                        <ShimmerBar width={120} height={34} />
                      )}
                      <Body tone={active ? "onLight" : "muted"} style={styles.planPeriod}>
                        / {offer.period}
                      </Body>
                    </View>

                    {!!offer.trialLabel && !!offer.displayPrice && (
                      <BodySm tone={active ? "onLight" : "dim"} style={styles.planTrial}>
                        {offer.trialLabel}, then {offer.displayPrice} / {offer.period}
                      </BodySm>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Reveal>

        {/* No currency or country label: StoreKit returns each price already
            formatted for the person's own storefront (riyals in Saudi Arabia,
            pounds in the UK), and NOIR never converts. A label only risked
            contradicting what Apple charges. */}
        {!loadingOffers && !storeReady && (
          <BodySm style={styles.storeWarning}>
            NOIR couldn't reach the App Store, so prices aren't available yet. They'll appear in
            your own currency once the store responds.
          </BodySm>
        )}

        {!!error && (
          <BodySm tone="danger" style={styles.error}>
            {error}
          </BodySm>
        )}

        <Reveal delay={340} style={styles.cta}>
          <NoirButton
            label={ctaLabel}
            plus
            loading={busy}
            disabled={busy || restoring || loadingOffers || !storeReady}
            onPress={buy}
          />

          <Pressable
            onPress={onRestore}
            disabled={busy || restoring}
            style={styles.restore}
            accessibilityRole="button"
          >
            <BodySm tone="muted" center>
              {restoring ? "Restoring..." : "Restore purchases"}
            </BodySm>
          </Pressable>
        </Reveal>

        {DEV_MOCK_PURCHASE_ENABLED && (
          <Card tone="plus" style={styles.devBox}>
            <Label tone="plus">⚠︎ Development build only</Label>
            <BodySm tone="dim" style={styles.devText}>
              This grants a simulated entitlement tagged "dev-mock". It is not an Apple purchase and
              is rejected by NOIR in any release build.
            </BodySm>
            <Pressable onPress={devMockPurchase} style={styles.devButton} accessibilityRole="button">
              <Type variant="button" tone="plus">
                Simulate purchase (not real)
              </Type>
            </Pressable>
          </Card>
        )}

        <BodySm tone="faint" style={styles.disclosure}>
          Payment is charged to your Apple ID at confirmation. Your subscription renews
          automatically unless auto-renew is turned off at least 24 hours before the end of the
          current period. Manage or cancel anytime in your Apple ID settings.
        </BodySm>

        {/* Guideline 3.1.2: a subscription paywall must link both the Terms of
            Use (EULA) and the Privacy Policy. Both are always shown. */}
        <View style={styles.legal}>
          <Pressable
            onPress={() => Linking.openURL(NOIR_LEGAL.termsUrl)}
            hitSlop={10}
            accessibilityRole="link"
          >
            <BodySm tone="muted" style={styles.legalLink}>
              Terms of Use (EULA)
            </BodySm>
          </Pressable>
          <BodySm tone="faint">·</BodySm>
          <Pressable
            onPress={() => Linking.openURL(NOIR_LEGAL.privacyUrl)}
            hitSlop={10}
            accessibilityRole="link"
          >
            <BodySm tone="muted" style={styles.legalLink}>
              Privacy Policy
            </BodySm>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  container: { padding: space.xxl, paddingBottom: space.giant },
  previewBanner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(147,167,196,0.35)",
    backgroundColor: "rgba(147,167,196,0.1)",
    padding: space.md,
    marginBottom: space.lg,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  close: { minHeight: hit.min, justifyContent: "center" },
  title: { marginTop: space.md },
  sub: { marginTop: space.md },
  list: { marginTop: space.xxl },
  row: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "center",
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  rowText: { flex: 1 },
  num: { width: 22 },
  desc: { marginTop: space.xs },
  offersLoading: { alignItems: "center", paddingVertical: space.xxxl },
  offersLoadingText: { marginTop: space.md },
  plans: { gap: space.md, marginTop: space.xxl },
  plan: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.xl,
  },
  planActive: { backgroundColor: color.plus, borderColor: color.plus },
  planTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.plusBorder,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  badgeActive: { borderColor: "rgba(5,5,5,0.3)" },
  badgeText: { letterSpacing: 0.8 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: space.sm },
  planPrice: { fontSize: 40, lineHeight: 46 },
  planPeriod: { marginBottom: 2 },
  planTrial: { marginTop: space.sm },
  storeWarning: { color: color.plusDim, marginTop: space.lg },
  error: { marginTop: space.lg },
  cta: { marginTop: space.xxl },
  restore: { minHeight: hit.min, justifyContent: "center", marginTop: space.sm },
  devBox: { marginTop: space.sm },
  devText: { marginTop: space.sm },
  devButton: {
    marginTop: space.md,
    minHeight: hit.min,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.plusBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  disclosure: { marginTop: space.xl },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
  },
  legalLink: { textDecorationLine: "underline" },
});
