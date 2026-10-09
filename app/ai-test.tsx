import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import auth from "@react-native-firebase/auth";
import Card from "../components/Card";
import NoirButton from "../components/NoirButton";
import CosmicBackground from "../components/CosmicBackground";
import Type, { Body, BodySm, Display, H2, Label, Micro } from "../components/Type";
import { color, space } from "../constants/theme";
import { NOIR_AI_MODELS } from "../constants/config";
import { generateReading, getSavedProfile, type NoirReading } from "../services/reading";

/**
 * Developer diagnostic for the Firebase AI Logic / App Check path. Not linked
 * from anywhere in the product — reach it at /ai-test during development.
 */
export default function AITest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NoirReading | null>(null);
  const [error, setError] = useState("");

  async function test() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (!auth().currentUser) {
        throw new Error("Create or sign in to a NOIR account before testing the AI.");
      }

      // Use the real saved profile so this exercises the same path as the app.
      const profile = (await getSavedProfile()) ?? {
        answers: ["Personal growth", "Relationships", "I take time to trust", "Achievement", "My personality"],
        birthDate: "01/01/2010",
        birthTime: "12:30",
        birthPlace: "Jeddah",
      };

      setResult(await generateReading(profile, false));
    } catch (e) {
      setError((e as Error)?.message || "AI request failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.safe}>
        <CosmicBackground faint />
        <ScrollView contentContainerStyle={styles.container}>
          <Micro>NOIR / Diagnostics</Micro>
          <Display style={styles.title}>Not available.</Display>
          <BodySm style={styles.sub}>This screen only runs in development builds.</BodySm>
          <NoirButton label="Back to NOIR" filled onPress={() => router.replace("/")} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <ScrollView contentContainerStyle={styles.container}>
        <Micro tone="plus">NOIR / AI test · dev only</Micro>
        <Display style={styles.title}>Real Gemini reading.</Display>
        <BodySm style={styles.sub}>
          Verifies Firebase AI Logic and App Check end to end. Model order:{" "}
          {NOIR_AI_MODELS.join(" → ")}
        </BodySm>

        <NoirButton
          label={loading ? "Generating..." : "Generate preview"}
          filled
          loading={loading}
          disabled={loading}
          onPress={test}
        />

        {loading && <ActivityIndicator style={styles.spinner} color={color.textHigh} />}

        {!!error && (
          <Card style={styles.error}>
            <BodySm tone="danger">{error}</BodySm>
          </Card>
        )}

        {result && (
          <Card style={styles.result}>
            <H2>{result.archetype}</H2>
            <Micro tone="muted" style={styles.traits}>
              {result.traits.join(" · ")}
            </Micro>
            <Body style={styles.body}>{result.core}</Body>
            <Label style={styles.heading}>Relationships</Label>
            <Body>{result.relationships}</Body>
          </Card>
        )}

        <View style={styles.footer}>
          <NoirButton label="Back to NOIR" quiet onPress={() => router.replace("/")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  container: { padding: space.xxl, paddingBottom: space.giant },
  title: { marginTop: space.md },
  sub: { marginTop: space.md, marginBottom: space.xxl },
  spinner: { marginTop: space.xxl },
  error: { marginTop: space.xl },
  result: { marginTop: space.xl },
  traits: { marginTop: space.sm },
  body: { marginTop: space.lg },
  heading: { marginTop: space.xxl, marginBottom: space.sm },
  footer: { marginTop: space.xxxl },
});
