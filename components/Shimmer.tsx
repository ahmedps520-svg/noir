import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { color, radius, space } from "../constants/theme";

/**
 * A single shimmering placeholder bar.
 *
 * Skeletons beat spinners here: a spinner says "wait", a skeleton says "this is
 * what is arriving", which makes the AI generation wait feel shorter and less
 * like the app has stalled.
 */
export function ShimmerBar({
  width = "100%",
  height = 14,
  delay = 0,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  return (
    <Animated.View
      style={[
        styles.bar,
        { width, height, borderRadius: height / 2 },
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }) },
        style,
      ]}
    />
  );
}

/** A paragraph-shaped skeleton: heading, then a few ragged body lines. */
export default function Shimmer({ lines = 3, heading = true }: { lines?: number; heading?: boolean }) {
  const widths: `${number}%`[] = ["100%", "94%", "88%", "72%", "96%"];

  return (
    <View>
      {heading && <ShimmerBar width="55%" height={22} style={styles.heading} />}
      {Array.from({ length: lines }, (_, i) => (
        <ShimmerBar
          key={i}
          width={widths[i % widths.length]}
          height={12}
          delay={i * 120}
          style={styles.line}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.surfaceStrong, borderRadius: radius.sm },
  heading: { marginBottom: space.lg },
  line: { marginBottom: space.md },
});
