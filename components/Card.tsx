import { useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { color, radius, space } from "../constants/theme";
import { tapFeedback } from "../services/haptics";

/**
 * The single card treatment for NOIR.
 *
 * Every screen previously declared its own borderRadius (20/22/23/24/25) and
 * border colour (#242424/#252525/#292929) inline, so surfaces never quite
 * matched. One component keeps them consistent and makes press feedback
 * automatic wherever a card is tappable.
 */
export default function Card({
  children,
  onPress,
  tone = "default",
  padded = true,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** "plus" gives the champagne treatment used for NOIR+ surfaces. */
  tone?: "default" | "raised" | "plus";
  padded?: boolean;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  const body = (
    <View
      style={[
        styles.card,
        tone === "raised" && styles.raised,
        tone === "plus" && styles.plus,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return body;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapFeedback();
          onPress();
        }}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  raised: { backgroundColor: color.surfaceHover, borderColor: color.borderStrong },
  plus: { backgroundColor: color.plusSurface, borderColor: color.plusBorder },
  padded: { padding: space.xl },
});
