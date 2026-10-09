import { router } from "expo-router";
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
import {
  configureGoogle,
  describeAuthError,
  sendPasswordReset,
  signInEmail,
  signInWithApple,
  signInWithGoogle,
  type NoirSignInResult,
} from "../services/auth";
import { errorFeedback } from "../services/haptics";
import { resolvePostAuthRoute } from "../services/routing";

type Busy = "apple" | "google" | "email" | null;

/**
 * Sign-in for people who already have a NOIR account. New users go through
 * onboarding first and create their account on /account, so this screen never
 * creates one.
 */
export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      configureGoogle();
    } catch (e) {
      if (__DEV__) console.warn("NOIR: Google Sign-In could not be configured.", e);
    }
  }, []);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<NoirSignInResult>) => {
    Keyboard.dismiss();
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      await action();
      router.replace(await resolvePostAuthRoute());
    } catch (e) {
      const message = describeAuthError(e);
      if (message !== "Sign-in was cancelled.") errorFeedback();
      setError(message);
      setBusy(null);
    }
  };

  const resetPassword = async () => {
    if (!email.includes("@")) {
      setError("Enter your email address first.");
      return;
    }
    setError("");
    try {
      await sendPasswordReset(email);
      setNotice("Password reset email sent. Check your inbox.");
    } catch (e) {
      setError(describeAuthError(e));
    }
  };

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
            <View style={styles.head}>
              <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button">
                <Micro tone="muted">← Back</Micro>
              </Pressable>
              <Micro>NOIR / Account</Micro>
            </View>

            <Reveal>
              <Display style={styles.title}>Welcome back.</Display>
              <BodySm style={styles.sub}>
                Sign in to continue your personal cosmic profile and reopen your full reading.
              </BodySm>
            </Reveal>

            <Reveal delay={120} style={styles.providers}>
              <AppleSignInButton type="signIn" onPress={() => run("apple", signInWithApple)} />

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
              autoComplete="current-password"
              placeholder="••••••••"
              placeholderTextColor={color.textFaint}
              accessibilityLabel="Password"
              returnKeyType="done"
              maxFontSizeMultiplier={1.3}
              onSubmitEditing={Keyboard.dismiss}
              style={styles.input}
            />

            {!!error && (
              <BodySm tone="danger" style={styles.message}>
                {error}
              </BodySm>
            )}
            {!!notice && (
              <BodySm style={[styles.message, { color: color.success }]}>{notice}</BodySm>
            )}
          </View>

          <View style={styles.actions}>
            <NoirButton
              label="Sign in"
              filled
              loading={busy === "email"}
              disabled={busy !== null || !email.includes("@") || password.length < 6}
              onPress={() => run("email", () => signInEmail(email, password))}
            />

            <Pressable onPress={resetPassword} style={styles.switch} accessibilityRole="button">
              <BodySm tone="muted" center>
                Forgot your password?
              </BodySm>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/onboarding")}
              style={styles.switch}
              accessibilityRole="button"
            >
              <Type variant="bodySm" tone="muted" center>
                New to NOIR?{"  "}
                <Type variant="bodySm" tone="high">
                  Build your profile
                </Type>
              </Type>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.xxl },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: space.lg, paddingBottom: space.xxxl, justifyContent: "space-between" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { minHeight: hit.min, justifyContent: "center" },
  title: { marginTop: space.xl },
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
  message: { marginTop: space.lg },
  actions: { marginTop: space.xxl },
  switch: { minHeight: hit.min, justifyContent: "center" },
});
