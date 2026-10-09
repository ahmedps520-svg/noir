import { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from "react-native";
import Type from "./Type";
import { color, hit, radius, space } from "../constants/theme";
import { pressFeedback, tapFeedback } from "../services/haptics";

export type NoirButtonProps = {
  label: string;
  onPress: () => void;
  /** Solid white — the single primary action on a screen. */
  filled?: boolean;
  /** Champagne treatment, reserved for NOIR+ actions. */
  plus?: boolean;
  /** Borderless text action for secondary choices. */
  quiet?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export default function NoirButton({
  label,
  onPress,
  filled = false,
  plus = false,
  quiet = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: NoirButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const blocked = disabled || loading;

  const press = (down: boolean) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: down ? 0.97 : 1,
        speed: 32,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(sweep, {
        toValue: down ? 1 : 0,
        duration: down ? 240 : 320,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-150, 320] });
  const tone = filled || plus ? "onLight" : "high";
  const spinner = filled || plus ? color.onLight : color.textHigh;

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: blocked ? 0.42 : 1 }}>
      <Pressable
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: blocked, busy: loading }}
        onPress={() => {
          if (blocked) return;
          filled || plus ? pressFeedback() : tapFeedback();
          onPress();
        }}
        onPressIn={() => !blocked && press(true)}
        onPressOut={() => !blocked && press(false)}
        style={[
          styles.base,
          quiet ? styles.quiet : styles.solid,
          filled && styles.filled,
          plus && styles.plus,
        ]}
      >
        {!quiet && (
          <Animated.View
            pointerEvents="none"
            style={[styles.sweep, { transform: [{ translateX: sweepX }, { rotate: "18deg" }] }]}
          />
        )}

        <Type variant="button" tone={quiet ? "muted" : tone} numberOfLines={1} style={styles.label}>
          {label}
        </Type>

        <View style={styles.trailing}>
          {loading ? (
            <ActivityIndicator size="small" color={quiet ? color.textMuted : spinner} />
          ) : (
            <Type variant="button" tone={quiet ? "muted" : tone} style={styles.arrow}>
              ↗
            </Type>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hit.button,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  solid: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  filled: { backgroundColor: color.textHigh, borderColor: color.textHigh },
  plus: { backgroundColor: color.plus, borderColor: color.plus },
  quiet: { minHeight: hit.min, backgroundColor: "transparent", justifyContent: "center" },
  sweep: {
    position: "absolute",
    width: 60,
    height: 130,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  label: { flexShrink: 1 },
  trailing: { minWidth: 20, alignItems: "flex-end" },
  arrow: { fontSize: 17, letterSpacing: 0 },
});
