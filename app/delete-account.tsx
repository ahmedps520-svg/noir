import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import Type, { Body, BodySm, Display, Label, Micro } from "../components/Type";
import { color, font, hit, radius, space } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { currentProvider, describeAuthError } from "../services/auth";
import { deleteNoirAccount, type DeletionStep } from "../services/deleteAccount";
import { errorFeedback, successFeedback } from "../services/haptics";
import { openManageSubscriptions } from "../services/subscription";

const WHAT_IS_DELETED = [
  "Your profile, onboarding answers and birth details",
  "Your preview and full readings",
  "Every daily reading and journal entry you wrote",
  "Your daily reminder",
  "Your NOIR login",
];

const STEP_LABEL: Record<DeletionStep, string> = {
  verifying: "Confirming it's you",
  revoking: "Disconnecting your Apple ID",
  erasing: "Erasing your readings and journal",
  closing: "Closing your account",
  done: "Done",
};

/**
 * In-app account deletion, required by App Store Review Guideline 5.1.1(v).
 *
 * Kept to one deliberate confirmation: Apple also says deletion must not be
 * made needlessly hard. Re-authentication — the Apple/Google sheet, or the
 * password field for email accounts — doubles as the second confirmation.
 */
export default function DeleteAccount() {
  const { user } = useAuth();
  const { isNoirPlus } = useSubscription();
  const provider = currentProvider();
  const needsPassword = provider === "password";

  const [password, setPassword] = useState("");
  const [step, setStep] = useState<DeletionStep | null>(null);
  const [error, setError] = useState("");
  // Captured before deleting: signing out resets the subscription context to
  // inactive, so reading isNoirPlus afterwards would hide the billing warning
  // at exactly the moment the person needs it.
  const [hadNoirPlus, setHadNoirPlus] = useState(false);
  const [appleLinkRevoked, setAppleLinkRevoked] = useState<boolean | null>(null);
  const working = step !== null && step !== "done";

  const confirm = async () => {
    Keyboard.dismiss();
    setError("");
    setHadNoirPlus(isNoirPlus);
    setStep("verifying");
    try {
      const result = await deleteNoirAccount({
        password: needsPassword ? password : undefined,
        onStep: setStep,
      });
      setAppleLinkRevoked(result.appleLinkRevoked);
      successFeedback();
      setStep("done");
    } catch (e) {
      setStep(null);
      const message = describeAuthError(e);
      // Backing out of the Apple/Google sheet is a choice, not a failure.
      if (message === "Sign-in was cancelled.") return;
      errorFeedback();
      setError(message);
    }
  };

  if (step === "done") {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <View style={styles.center}>
          <Micro>NOIR / Account</Micro>
          <Display center style={styles.doneTitle}>
            Your account has been deleted.
          </Display>
          <BodySm center style={styles.doneSub}>
            Your profile, readings and journal have been permanently erased.
          </BodySm>
          {hadNoirPlus && (
            <BodySm center tone="plus" style={styles.doneSub}>
              If you haven't already, cancel NOIR+ in your Apple ID settings — Apple bills it
              separately.
            </BodySm>
          )}
          {appleLinkRevoked === false && (
            <BodySm center tone="muted" style={styles.doneSub}>
              To also remove NOIR from your Apple ID, open Settings, tap your name, then
              Sign-In & Security, Sign in with Apple, NOIR, and Stop Using Apple ID.
            </BodySm>
          )}
          <View style={styles.doneActions}>
            <NoirButton label="Close" filled onPress={() => router.replace("/")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const passwordTooShort = needsPassword && password.length < 6;

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            disabled={working}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
          >
            <Micro tone="muted">← Back</Micro>
          </Pressable>

          <Reveal>
            <Label tone="danger">Delete account</Label>
            <Display style={styles.title}>This can't be undone.</Display>
            <Body tone="muted" style={styles.sub}>
              Deleting {user?.email ? <Body tone="high">{user.email}</Body> : "your account"}{" "}
              permanently erases everything NOIR holds for you:
            </Body>
          </Reveal>

          <Reveal delay={100}>
            <View style={styles.list}>
              {WHAT_IS_DELETED.map(item => (
                <View key={item} style={styles.listRow}>
                  <Type variant="body" tone="danger" style={styles.bullet}>
                    ×
                  </Type>
                  <Body style={styles.listText}>{item}</Body>
                </View>
              ))}
            </View>
          </Reveal>

          {/* Apple subscriptions survive account deletion. Say so before the
              person deletes, not after they are charged again. */}
          {isNoirPlus && (
            <Reveal delay={160}>
              <Card tone="plus" style={styles.subscription}>
                <Label tone="plus">Your NOIR+ subscription</Label>
                <BodySm tone="muted" style={styles.subscriptionBody}>
                  NOIR+ is billed by Apple, and deleting your account does not cancel it. Cancel it
                  in your Apple ID settings first, or you will keep being charged.
                </BodySm>
                <NoirButton label="Manage subscription" plus onPress={openManageSubscriptions} />
              </Card>
            </Reveal>
          )}

          <Reveal delay={220}>
            {needsPassword ? (
              <>
                <Label style={styles.passwordLabel}>Enter your password to confirm</Label>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  placeholder="Password"
                  placeholderTextColor={color.textFaint}
                  accessibilityLabel="Password"
                  returnKeyType="done"
                  editable={!working}
                  maxFontSizeMultiplier={1.3}
                  onSubmitEditing={Keyboard.dismiss}
                  style={styles.input}
                />
              </>
            ) : (
              <BodySm tone="dim" style={styles.providerNote}>
                {provider === "apple"
                  ? "You'll be asked to confirm with Apple. This also removes NOIR from the apps using your Apple ID."
                  : provider === "google"
                    ? "You'll be asked to confirm with Google."
                    : "You'll be asked to confirm it's you."}
              </BodySm>
            )}
          </Reveal>

          {!!error && (
            <BodySm tone="danger" style={styles.error}>
              {error}
            </BodySm>
          )}

          <View style={styles.actions}>
            {working && step ? (
              <View style={styles.progress}>
                <ActivityIndicator color={color.danger} size="small" />
                <BodySm tone="muted">{STEP_LABEL[step]}</BodySm>
              </View>
            ) : (
              <Pressable
                onPress={confirm}
                disabled={passwordTooShort}
                accessibilityRole="button"
                accessibilityLabel="Permanently delete my account"
                accessibilityState={{ disabled: passwordTooShort }}
                style={({ pressed }) => [
                  styles.deleteButton,
                  passwordTooShort && styles.deleteDisabled,
                  pressed && styles.deletePressed,
                ]}
              >
                <Type variant="button" style={styles.deleteText}>
                  Permanently delete my account
                </Type>
              </Pressable>
            )}

            <NoirButton
              label="Keep my account"
              quiet
              disabled={working}
              onPress={() => router.back()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  container: { padding: space.xxl, paddingBottom: space.giant },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  back: { minHeight: hit.min, justifyContent: "center", marginBottom: space.lg },
  title: { marginTop: space.md },
  sub: { marginTop: space.md },
  list: { marginTop: space.xl, gap: space.md },
  listRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  bullet: { width: 16, lineHeight: 26 },
  listText: { flex: 1 },
  subscription: { marginTop: space.xxl },
  subscriptionBody: { marginTop: space.sm, marginBottom: space.lg },
  passwordLabel: { marginTop: space.xxl },
  input: {
    minHeight: 60,
    marginTop: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    color: color.textHigh,
    paddingHorizontal: space.lg,
    fontSize: 16,
    fontFamily: font.body,
  },
  providerNote: { marginTop: space.xxl },
  error: { marginTop: space.lg },
  actions: { marginTop: space.xxxl, gap: space.sm },
  progress: {
    minHeight: hit.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  deleteButton: {
    minHeight: hit.button,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.danger,
    backgroundColor: "rgba(216,154,154,0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxl,
  },
  deleteDisabled: { opacity: 0.4 },
  deletePressed: { backgroundColor: "rgba(216,154,154,0.22)", transform: [{ scale: 0.98 }] },
  deleteText: { color: color.danger },
  doneTitle: { marginTop: space.md },
  doneSub: { marginTop: space.md },
  doneActions: { marginTop: space.xxxl, alignSelf: "stretch" },
});
