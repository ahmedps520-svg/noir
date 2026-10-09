import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CityPicker from "../components/CityPicker";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import Reveal from "../components/Reveal";
import Type, { BodySm, Display, Label, Micro } from "../components/Type";
import BirthDateFields, {
  EMPTY_BIRTH_FIELDS,
  formatBirthDate,
  formatBirthTime,
  isBirthFieldsComplete,
  validateBirthFields,
  type BirthFields,
} from "../components/BirthDateFields";
import { color, hit, radius, space } from "../constants/theme";
import { NOIR_LEGAL } from "../constants/config";
import { tapFeedback } from "../services/haptics";
import { cityLabel, type City } from "../services/cities";

export default function Birth() {
  const params = useLocalSearchParams();
  const [fields, setFields] = useState<BirthFields>(EMPTY_BIRTH_FIELDS);
  const [city, setCity] = useState<City | null>(null);

  // App Store Review Guideline 5.1.2: sharing personal data with third-party AI
  // needs a clear disclosure and explicit permission BEFORE anything is sent.
  // Nothing reaches Gemini until after this screen, so this is the place to ask.
  const [aiConsent, setAiConsent] = useState(false);

  const validationError = validateBirthFields(fields);
  // A chosen place, not typed text: the chart needs its coordinates and zone.
  const ready = isBirthFieldsComplete(fields) && !validationError && city !== null && aiConsent;

  const submit = () => {
    if (!city || !aiConsent) return;
    Keyboard.dismiss();
    router.push({
      pathname: "/account",
      params: {
        date: formatBirthDate(fields),
        time: formatBirthTime(fields),
        place: cityLabel(city),
        lat: String(city.latitude),
        lon: String(city.longitude),
        tz: city.timezone,
        answers: String(params.answers ?? "[]"),
        aiConsent: "1",
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Keyboard dismissal comes from keyboardShouldPersistTaps="handled"
              plus keyboardDismissMode on the ScrollView. Do NOT wrap these
              fields in a Pressable to dismiss it — the Pressable competes with
              the TextInputs for the touch and they stop accepting focus. */}
          <View>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button">
                <Micro tone="muted">← Back</Micro>
              </Pressable>
              <Micro>06 / 06</Micro>
            </View>

            <Reveal style={styles.heading}>
              <Micro style={styles.kicker}>Your birth map</Micro>
              <Display>When & where were you born?</Display>
              <BodySm style={styles.sub}>About 20 seconds. Private to your account.</BodySm>
            </Reveal>

            <View style={styles.form}>
              <BirthDateFields fields={fields} onChange={setFields} />

              <Label style={styles.placeLabel}>Birthplace</Label>
              <CityPicker value={city} onChange={setCity} />

              {!!validationError && (
                <BodySm tone="danger" style={styles.error}>
                  {validationError}
                </BodySm>
              )}
            </View>
          </View>

          {/* GeoNames is CC BY 4.0 — attribution is a licence condition. */}
          <Micro tone="faint" style={styles.attribution}>
            City data © GeoNames · CC BY 4.0
          </Micro>

          <Pressable
            onPress={() => {
              tapFeedback();
              setAiConsent(v => !v);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aiConsent }}
            aria-checked={aiConsent}
            accessibilityLabel="Allow NOIR to send my answers and calculated chart to Google's Gemini AI to write my readings"
            style={({ pressed }) => [styles.consent, aiConsent && styles.consentOn, pressed && styles.consentPressed]}
          >
            <View style={[styles.box, aiConsent && styles.boxOn]}>
              {aiConsent && (
                <Type variant="button" tone="onLight" style={styles.tick}>
                  ✓
                </Type>
              )}
            </View>
            <View style={styles.consentText}>
              <BodySm tone="high">
                Send my answers and the chart calculated from my birth details to Google&apos;s
                Gemini AI to write my readings.
              </BodySm>
              <BodySm tone="dim" style={styles.consentSub}>
                Your name, email and raw birth details are not sent. Your journal never is.{" "}
                <Type
                  variant="bodySm"
                  tone="plus"
                  onPress={() => Linking.openURL(NOIR_LEGAL.privacyUrl)}
                  suppressHighlighting
                >
                  Privacy policy
                </Type>
              </BodySm>
            </View>
          </Pressable>

          <View style={styles.buttonWrap}>
            <NoirButton label="Save & continue" filled disabled={!ready} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.xxl },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: space.sm, paddingBottom: space.xxl, justifyContent: "space-between" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { minHeight: hit.min, justifyContent: "center" },
  heading: { marginTop: space.xl },
  kicker: { marginBottom: space.sm },
  sub: { marginTop: space.md },
  form: { marginTop: space.xxxl },
  placeLabel: { marginTop: space.xxl },
  attribution: { marginTop: space.xl },
  consent: {
    flexDirection: "row",
    gap: space.md,
    marginTop: space.xxl,
    padding: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  consentOn: { borderColor: color.plusBorder, backgroundColor: color.plusSurface },
  consentPressed: { opacity: 0.85 },
  box: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: color.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: color.plus, borderColor: color.plus },
  tick: { fontSize: 14, lineHeight: 16, letterSpacing: 0 },
  consentText: { flex: 1 },
  consentSub: { marginTop: space.xs },
  error: { marginTop: space.md },
  buttonWrap: { marginTop: space.xxl },
});
