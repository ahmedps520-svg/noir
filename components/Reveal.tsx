import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

/**
 * Entrance animation used across NOIR: content lifts and fades in.
 * Staggering `delay` down a screen gives the reveal its cinematic feel without
 * every screen re-implementing the same Animated boilerplate.
 */
export default function Reveal({
  children,
  delay = 0,
  distance = 16,
  duration = 520,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
