import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import Type from "./Type";
import { type TextStyle } from "react-native";

/**
 * Counts up to a value rather than snapping to it.
 *
 * Used for the streak and journal stats — a number that climbs reads as
 * progress, where the same number appearing instantly reads as static data.
 */
export default function AnimatedNumber({
  value,
  variant = "display",
  tone,
  duration = 900,
  style,
}: {
  value: number;
  variant?: "display" | "h1" | "h2" | "title";
  tone?: "high" | "plus" | "muted";
  duration?: number;
  style?: TextStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const from = previous.current;
    const to = value;
    previous.current = value;

    if (from === to) {
      setShown(to);
      return;
    }

    progress.setValue(0);
    const listener = progress.addListener(({ value: t }) => {
      setShown(Math.round(from + (to - from) * t));
    });

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      // Driving JS state, so this cannot run on the native thread.
      useNativeDriver: false,
    });
    animation.start(() => setShown(to));

    return () => {
      animation.stop();
      progress.removeListener(listener);
    };
  }, [value, duration, progress]);

  return (
    <Type variant={variant} tone={tone} style={style}>
      {shown}
    </Type>
  );
}
