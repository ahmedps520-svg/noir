import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import Type, { BodySm, Display, Micro } from "../components/Type";
import { color, hit, radius, space } from "../constants/theme";
import { tapFeedback } from "../services/haptics";

type Question = {
  title: string;
  /** Short topic saved with the answer, so the model knows what was asked. */
  topic: string;
  options: string[];
};

/**
 * Five different dimensions, no option repeated across them. The previous set
 * asked three near-identical questions that all offered Relationships and
 * Direction, which read as filler and gave the model the same signal twice.
 */
const QUESTIONS: Question[] = [
  {
    title: "Where do you get your energy?",
    topic: "Energy",
    options: ["Time on my own", "A few close people", "A full room", "It changes day to day"],
  },
  {
    title: "When a big decision lands, you…",
    topic: "Deciding",
    options: ["Trust your gut", "Research everything", "Ask people you trust", "Wait until it's obvious"],
  },
  {
    title: "When things go wrong, you…",
    topic: "Under pressure",
    options: ["Take control", "Go quiet", "Talk it through", "Push on, deal with it later"],
  },
  {
    title: "In close relationships, you're the one who…",
    topic: "In relationships",
    options: ["Keeps the peace", "Says the hard thing", "Needs space", "Gives more than they get"],
  },
  {
    title: "What do you want most right now?",
    topic: "Wants now",
    options: ["Clarity on where I'm going", "Deeper connection", "To break a pattern", "To trust myself more"],
  },
];

/** The birth screen is the last step, so progress counts it too. */
const TOTAL_STEPS = QUESTIONS.length + 1;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  const question = QUESTIONS[step];

  const animateProgress = (nextStep: number) => {
    Animated.timing(progress, {
      toValue: (nextStep + 1) / TOTAL_STEPS,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  // Synchronous guard: state would lag a frame, letting a double tap start two
  // transitions at once.
  const transitionLock = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * Swap the question at the midpoint of the fade so text never changes
   * mid-visible, and block input while the old question is still on screen
   * (otherwise a fast tap lands on an option the user can no longer see).
   *
   * State changes run on timers, not animation callbacks. An earlier version
   * released the lock only when the fade reported `finished`; if the fade was
   * ever interrupted, the lock never released and onboarding froze for good.
   * Timers always fire, so this cannot strand anyone.
   */
  const transitionTo = (nextStep: number, nextSelected: string) => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setTransitioning(true);

    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start();

    timers.current.push(
      setTimeout(() => {
        setStep(nextStep);
        setSelected(nextSelected);
        animateProgress(nextStep);
        Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 150),
      setTimeout(() => {
        fade.setValue(1);
        transitionLock.current = false;
        setTransitioning(false);
      }, 470),
    );
  };

  const goNext = () => {
    if (!selected || transitionLock.current) return;
    const collected = [...answers.slice(0, step), selected];

    if (step === QUESTIONS.length - 1) {
      // Saved as "Topic: answer" so the reading engine knows what each one answers.
      const labelled = collected.map((answer, i) => `${QUESTIONS[i].topic}: ${answer}`);
      router.push({ pathname: "/birth", params: { answers: JSON.stringify(labelled) } });
      return;
    }

    setAnswers(collected);
    transitionTo(step + 1, collected[step + 1] ?? "");
  };

  const goBack = () => {
    tapFeedback();
    if (step === 0) {
      router.back();
      return;
    }
    transitionTo(step - 1, answers[step - 1] ?? "");
  };

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />

      <View style={styles.head}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Micro tone="muted">← Back</Micro>
        </Pressable>
        <Micro>
          {String(step + 1).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}
        </Micro>
      </View>

      <View style={styles.bar}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>

      <Animated.View
        style={[styles.body, { opacity: fade }]}
        pointerEvents={transitioning ? "none" : "auto"}
      >
        <Micro style={styles.kicker}>About you</Micro>
        <Display style={styles.title}>{question.title}</Display>
        <BodySm style={styles.sub}>
          NOIR reads your answers alongside your full birth chart — a reading about you, not just your star sign.
        </BodySm>

        <View style={styles.options}>
          {question.options.map((option, index) => {
            const active = selected === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  tapFeedback();
                  setSelected(option);
                }}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionSelected,
                  pressed && !active && styles.optionPressed,
                ]}
              >
                <Micro tone={active ? "onLight" : "faint"} style={styles.optionNum}>
                  {String(index + 1).padStart(2, "0")}
                </Micro>
                <Type variant="body" tone={active ? "onLight" : "default"} style={styles.optionText}>
                  {option}
                </Type>
                <Type variant="body" tone={active ? "onLight" : "faint"}>
                  ↗
                </Type>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <NoirButton
        label={step === QUESTIONS.length - 1 ? "Continue to birth info" : "Continue"}
        filled
        disabled={!selected}
        onPress={goNext}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: space.xxl,
    paddingVertical: space.lg,
    justifyContent: "space-between",
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { minHeight: hit.min, justifyContent: "center" },
  bar: { height: 2, backgroundColor: "rgba(255,255,255,0.09)", marginTop: space.md, overflow: "hidden" },
  fill: { height: 2, backgroundColor: color.textHigh },
  body: { flex: 1, justifyContent: "center" },
  kicker: { marginBottom: space.md },
  title: { fontSize: 38, lineHeight: 44 },
  sub: { marginTop: space.md, maxWidth: 320 },
  options: { gap: space.sm + 2, marginTop: space.xxl },
  option: {
    minHeight: 62,
    borderRadius: radius.sm + 4,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  optionSelected: { backgroundColor: color.textHigh, borderColor: color.textHigh },
  optionPressed: { borderColor: color.borderStrong, backgroundColor: color.surfaceHover },
  optionNum: { width: 24, letterSpacing: 0.6 },
  optionText: { flex: 1 },
});
