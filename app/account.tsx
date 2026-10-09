import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import AppleSignInButton from "../components/AppleSignInButton";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import Type, { BodySm, Display, Label, Micro } from "../components/Type";
import { color, font, hit, radius, space } from "../constants/theme";
import { normalizeAnswers, saveNoirProfile } from "../firebase/profile";
import {
  configureGoogle,
  createEmailAccount,
  describeAuthError,
  signInEmail,
  signInWithApple,
  signInWithGoogle,
  type NoirSignInResult,
} from "../services/auth";
import { errorFeedback, successFeedback } from "../services/haptics";
import { resolvePostAuthRoute } from "../services/routing";

type Busy = "apple" | "google" | "email" | null;

export default function Account() {
  const params = useLocalSearchParams();
  const [mode, setMode] = useState<"create" | "login">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      configureGoogle();
    } catch (e) {
      if (__DEV__) console.warn("NOIR: Google Sign-In could not be configured.", e);
    }
  }, []);

  /**
   * One place where every sign-in method lands: persist the onboarding data
   * against the new Firebase UID, then continue the flow.
   */
  const completeSignIn = async (result: NoirSignInResult) => {
    await saveNoirProfile({
      displayName: result.fullName,
      birthDate: String(params.date ?? ""),
      birthTime: String(params.time ?? ""),
      birthPlace: String(params.place ?? ""),
      birthLatitude: params.lat ? Number(params.lat) : null,
      birthLongitude: params.lon ? Number(params.lon) : null,
      birthTimezone: params.tz ? String(params.tz) : null,
      // When the person agreed to AI processing on the birth screen (Guideline 5.1.2).
      ...(params.aiConsent === "1" ? { aiConsentAt: new Date().toISOString() } : {}),
      onboardingAnswers: normalizeAnswers(params.answers),
    });

    successFeedback();

    // A returning user who already pays should not be walked through the
    // preview and paywall again.
    const destination = await resolvePostAuthRoute();
    if (destination === "/generate") {
      router.replace({ pathname: "/generate", params });
      return;
    }
    router.replace(destination);
  };

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<NoirSignInResult>) => {
    Keyboard.dismiss();
    setBusy(kind);
    setError("");
    try {
      await completeSignIn(await action());
    } catch (e) {
      const message = describeAuthError(e);
      if (message !== "Sign-in was cancelled.") errorFeedback();
      setError(message);
      setBusy(null);
    }
  };

  const emailValid = email.includes("@") && email.trim().length > 4;
  const passwordValid = password.length >= 6;

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Reveal>
              <Micro style={styles.kicker}>Your profile is yours</Micro>
              <Display>{mode === "create" ? "Save your NOIR profile." : "Welcome back."}</Display>
              <BodySm style={styles.sub}>
                {mode === "create"
                  ? "Create your account once. NOIR then reveals your personalized preview."
                  : "Sign in to continue your personal cosmic profile."}
              </BodySm>
            </Reveal>

            <Reveal delay={120} style={styles.providers}>
              <AppleSignInButton type="continue" onPress={() => run("apple", signInWithApple)} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                disabled={busy !== null}
                onPress={() => run("google", signInWithGoogle)}
                style={({ pressed }) => [styles.provider, pressed && styles.providerPressed]}
              >
                {busy === "google" ? (
                  <ActivityIndicator color={color.textHigh} size="small" />
                ) : (
                  <>
                    <Type variant="title" style={styles.providerIcon}>
                      G
                    </Type>
                    <Type variant="button">Continue with Google</Type>
                  </>
                )}
              </Pressable>
            </Reveal>

            <View style={styles.or}>
              <View style={styles.line} />
              <Micro tone="faint">or use email</Micro>
              <View style={styles.line} />
            </View>

            <Label>Email</Label>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={color.textFaint}
              accessibilityLabel="Email address"
              maxFontSizeMultiplier={1.3}
              style={styles.input}
            />

            <Label style={styles.label}>Password</Label>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              placeholder="6+ characters"
              placeholderTextColor={color.textFaint}
              accessibilityLabel="Password"
              returnKeyType="done"
              maxFontSizeMultiplier={1.3}
              onSubmitEditing={Keyboard.dismiss}
              style={styles.input}
            />

            {!!error && (
              <BodySm tone="danger" style={styles.error}>
                {error}
              </BodySm>
            )}
          </View>

          <View style={styles.actions}>
            <NoirButton
              label={mode === "create" ? "Create my account" : "Sign in"}
              filled
              loading={busy === "email"}
              disabled={busy !== null || !emailValid || !passwordValid}
              onPress={() =>
                run("email", () =>
                  mode === "create"
                    ? createEmailAccount(email, password)
                    : signInEmail(email, password),
                )
              }
            />

            <Pressable
              onPress={() => {
                setMode(mode === "create" ? "login" : "create");
                setError("");
              }}
              style={styles.switch}
              accessibilityRole="button"
            >
              <Type variant="bodySm" tone="muted" center>
                {mode === "create" ? "Already have an account?  " : "New to NOIR?  "}
                <Type variant="bodySm" tone="high">
                  {mode === "create" ? "Sign in" : "Create account"}
                </Type>
              </Type>
            </Pressable>

            <BodySm tone="faint" center style={styles.privacy}>
              NOIR uses Firebase Authentication. Your birth information and readings are stored
              privately against your account.
            </BodySm>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.xxl },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: space.xl, paddingBottom: space.xxxl, justifyContent: "space-between" },
  kicker: { marginBottom: space.sm },
  sub: { marginTop: space.md },
  providers: { gap: space.sm + 2, marginTop: space.xxl },
  provider: {
    minHeight: hit.button,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceHover,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  providerPressed: { backgroundColor: color.surfaceStrong },
  providerIcon: { fontFamily: font.semibold },
  or: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.xxl },
  line: { height: 1, backgroundColor: color.border, flex: 1 },
  label: { marginTop: space.lg },
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
  error: { marginTop: space.lg },
  actions: { marginTop: space.xxl },
  switch: { minHeight: hit.min, justifyContent: "center", paddingVertical: space.md },
  privacy: { marginTop: space.xs },
});
