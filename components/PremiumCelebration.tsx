import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import Type, { Micro } from "./Type";
import { color, glow, radius, space } from "../constants/theme";
import { successFeedback } from "../services/haptics";

const { width, height } = Dimensions.get("window");

/**
 * Deterministic scatter — a fixed pattern reads as designed, whereas random
 * placement clumps and looks accidental.
 */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  x: (((i * 61) % 100) / 100) * width,
  y: (((i * 43) % 100) / 100) * height,
  size: 1.5 + (i % 3),
  rise: 70 + (i % 6) * 30,
  delay: i * 26,
  duration: 1100 + (i % 5) * 160,
}));

export default function PremiumCelebration({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.78)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringOne = useRef(new Animated.Value(0)).current;
  const ringTwo = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => PARTICLES.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    successFeedback();

    const entrance = Animated.parallel([
      Animated.spring(scale, { toValue: 1, speed: 12, bounciness: 6, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(ringOne, {
        toValue: 1,
        duration: 1300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(260),
        Animated.timing(ringTwo, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      ...particles.map((value, i) =>
        Animated.sequence([
          Animated.delay(PARTICLES[i].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: PARTICLES[i].duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]);

    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );

    entrance.start();
    sweep.start();

    const timer = setTimeout(onDone, 2600);
    return () => {
      clearTimeout(timer);
      entrance.stop();
      sweep.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 320] });

  return (
    <View style={styles.overlay} pointerEvents="none">
      {PARTICLES.map((particle, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              opacity: particles[i].interpolate({
                inputRange: [0, 0.25, 0.75, 1],
                outputRange: [0, 0.9, 0.7, 0],
              }),
              transform: [
                {
                  translateY: particles[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -particle.rise],
                  }),
                },
              ],
            },
          ]}
        />
      ))}

      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringOne.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.4, 0] }),
            transform: [{ scale: ringOne.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.5] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringTwo.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.25, 0] }),
            transform: [{ scale: ringTwo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.9] }) }],
          },
        ]}
      />

      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { rotate: "18deg" }] }]}
        />
        <View style={styles.mark}>
          <Type variant="h2" tone="plus">
            ✦
          </Type>
        </View>
        <Micro tone="plus">Welcome to</Micro>
        <Type variant="hero" style={styles.wordmark}>
          NOIR+
        </Type>
        <Micro tone="dim" center style={styles.copy}>
          Your full cosmic profile is now unlocked.
        </Micro>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,2,2,0.96)",
    zIndex: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: { position: "absolute", backgroundColor: color.plus, borderRadius: 9 },
  ring: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: color.plusBorder,
  },
  card: {
    width: 310,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.plusBorder,
    backgroundColor: "#0C0C0C",
    padding: space.xxxl,
    alignItems: "center",
    overflow: "hidden",
    ...glow,
  },
  shimmer: {
    position: "absolute",
    width: 70,
    height: 460,
    backgroundColor: "rgba(216,196,154,0.07)",
  },
  mark: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: color.plusBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xl,
  },
  wordmark: { fontSize: 46, lineHeight: 54, letterSpacing: 3, marginTop: space.xs },
  copy: { marginTop: space.md, letterSpacing: 1.2 },
});
