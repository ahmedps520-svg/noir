import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Haptics are pure polish — a device that cannot vibrate, or a simulator,
 * must never surface an error because of them.
 */
function safe(run: () => Promise<void>) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  run().catch(() => undefined);
}

/** Light tap: navigation, option selection, tab changes. */
export function tapFeedback() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Firmer tap: primary buttons that advance the flow. */
export function pressFeedback() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Reserved for the NOIR+ unlock and other genuine milestones. */
export function successFeedback() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function errorFeedback() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
