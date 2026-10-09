import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Star = { left: number; top: number; size: number; group: number };

// Fixed field: a designed constellation reads better than random scatter, and
// keeping it module-level avoids rebuilding the array on every render.
const STARS: Star[] = [
  [7, 12], [19, 28], [31, 8], [45, 19], [62, 11], [81, 25], [93, 9],
  [12, 48], [27, 59], [42, 44], [57, 63], [74, 49], [90, 57],
  [5, 78], [21, 88], [38, 74], [55, 91], [71, 79], [88, 90],
].map(([left, top], i) => ({
  left,
  top,
  size: 1.5 + (i % 3) * 0.7,
  group: i % 3,
}));

export default function CosmicBackground({ faint = false }: { faint?: boolean }) {
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  // Three shared twinkle values rather than one per star — same effect, far
  // fewer running animations.
  const twinkle = useRef([0, 1, 2].map(() => new Animated.Value(0.5))).current;

  useEffect(() => {
    const loop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );

    const animations = [
      loop(driftX, 15000),
      loop(driftY, 21000),
      ...twinkle.map((value, i) => loop(value, 2400 + i * 900)),
    ];

    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [driftX, driftY, twinkle]);

  const x = driftX.interpolate({ inputRange: [0, 1], outputRange: [-30, 35] });
  const y = driftY.interpolate({ inputRange: [0, 1], outputRange: [20, -25] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.orb1,
          { transform: [{ translateX: x }, { translateY: y }], opacity: faint ? 0.06 : 0.12 },
        ]}
      />
      <Animated.View
        style={[
          styles.orb2,
          { transform: [{ translateX: y }, { translateY: x }], opacity: faint ? 0.045 : 0.09 },
        ]}
      />

      {STARS.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              borderRadius: star.size,
              opacity: twinkle[star.group].interpolate({
                inputRange: [0, 1],
                outputRange: faint ? [0.12, 0.34] : [0.2, 0.6],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  orb1: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    left: -130,
    top: -100,
    backgroundColor: "#FFF",
  },
  orb2: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    right: -180,
    bottom: -110,
    backgroundColor: "#FFF",
  },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
});
