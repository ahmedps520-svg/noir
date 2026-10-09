import { Platform } from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";

/**
 * The daily reading reminder.
 *
 * This is a LOCAL scheduled notification, not a remote push. A daily reminder
 * needs no server, no APNs send infrastructure and no network at fire time —
 * the OS owns the schedule. Remote push would only be needed for content that
 * must be composed server-side.
 *
 * The reminder repeats daily and deliberately does not know whether today's
 * reading has already been opened: iOS cannot conditionally suppress a single
 * occurrence of a repeating trigger, and a reminder that silently stops for
 * lapsed users would defeat the point.
 */

export const IDENTIFIER = "noir-daily-reading";

export type ReminderPreference = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const DEFAULT_REMINDER: ReminderPreference = { enabled: false, hour: 8, minute: 0 };

/** Rotating copy so the reminder does not read like the same alarm every day. */
const BODIES = [
  "Today's reading is ready.",
  "A new reading is waiting for you.",
  "Your reading for today has arrived.",
];

export function formatReminderTime(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function isSupported() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * How a notification behaves when it fires while NOIR is already open.
 * Called once at startup, before any listener is registered.
 */
export function configureNotificationHandler() {
  if (!isSupported()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/* ------------------------------------------------------------------ *
 * Permission
 * ------------------------------------------------------------------ */

export async function getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  if (!isSupported()) return "denied";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  // iOS only allows one system prompt; after that "denied" means Settings.
  return status === "undetermined" && canAskAgain ? "undetermined" : "denied";
}

export async function requestPermission(): Promise<boolean> {
  if (!isSupported()) return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return status === "granted";
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

async function clearExisting() {
  // Cancel by identifier where possible, and sweep any orphans left behind by
  // an earlier install or a changed identifier.
  try {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
  } catch {
    // Nothing scheduled under that identifier.
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(item => item.identifier === IDENTIFIER || item.content.data?.noir === "daily")
      .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => undefined)),
  );
}

export async function scheduleDailyReminder(hour: number, minute: number) {
  if (!isSupported()) return;
  await clearExisting();

  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: "NOIR",
      body: BODIES[Math.floor(Math.random() * BODIES.length)],
      data: { noir: "daily", route: "/daily" },
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyReminder() {
  if (!isSupported()) return;
  await clearExisting();
}

export async function hasScheduledReminder() {
  if (!isSupported()) return false;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some(item => item.identifier === IDENTIFIER);
}

/* ------------------------------------------------------------------ *
 * Preference (Firestore, so it survives a reinstall)
 * ------------------------------------------------------------------ */

function userDoc(uid: string) {
  return firestore().collection("users").doc(uid);
}

export async function loadReminderPreference(): Promise<ReminderPreference> {
  const user = auth().currentUser;
  if (!user) return DEFAULT_REMINDER;

  const snap = await userDoc(user.uid).get();
  const stored = snap.data()?.dailyReminder as Partial<ReminderPreference> | undefined;
  if (!stored) return DEFAULT_REMINDER;

  return {
    enabled: Boolean(stored.enabled),
    hour: typeof stored.hour === "number" ? clampHour(stored.hour) : DEFAULT_REMINDER.hour,
    minute: typeof stored.minute === "number" ? clampMinute(stored.minute) : DEFAULT_REMINDER.minute,
  };
}

export async function saveReminderPreference(preference: ReminderPreference) {
  const user = auth().currentUser;
  if (!user) return;
  await userDoc(user.uid).set({ dailyReminder: preference }, { merge: true });
}

function clampHour(value: number) {
  return Math.min(23, Math.max(0, Math.round(value)));
}

function clampMinute(value: number) {
  return Math.min(59, Math.max(0, Math.round(value)));
}

/**
 * Reconcile the OS schedule with the stored preference.
 *
 * Run on launch and whenever entitlement changes. The schedule lives on the
 * device while the preference lives in Firestore, so they drift apart after a
 * reinstall, a new device, a revoked permission, or a lapsed subscription.
 */
export async function syncReminder(entitled: boolean): Promise<ReminderPreference> {
  const preference = await loadReminderPreference().catch(() => DEFAULT_REMINDER);
  if (!isSupported()) return preference;

  // Daily readings are a NOIR+ feature; do not remind people about something
  // they can no longer open.
  if (!entitled || !preference.enabled) {
    await cancelDailyReminder().catch(() => undefined);
    return preference;
  }

  const granted = (await getPermissionStatus()) === "granted";
  if (!granted) {
    await cancelDailyReminder().catch(() => undefined);
    // Permission was revoked in Settings — reflect that rather than showing an
    // enabled toggle that silently does nothing.
    const corrected = { ...preference, enabled: false };
    await saveReminderPreference(corrected).catch(() => undefined);
    return corrected;
  }

  if (!(await hasScheduledReminder())) {
    await scheduleDailyReminder(preference.hour, preference.minute).catch(() => undefined);
  }

  return preference;
}

/**
 * Turn the reminder on, requesting permission if it has not been asked for yet.
 * Returns the resulting preference so callers can reflect a denied prompt.
 */
export async function enableReminder(hour: number, minute: number): Promise<ReminderPreference> {
  const status = await getPermissionStatus();

  if (status !== "granted") {
    const granted = await requestPermission();
    if (!granted) {
      const off = { enabled: false, hour, minute };
      await saveReminderPreference(off).catch(() => undefined);
      return off;
    }
  }

  await scheduleDailyReminder(hour, minute);
  const preference = { enabled: true, hour, minute };
  await saveReminderPreference(preference);
  return preference;
}

export async function disableReminder(hour: number, minute: number): Promise<ReminderPreference> {
  await cancelDailyReminder();
  const preference = { enabled: false, hour, minute };
  await saveReminderPreference(preference);
  return preference;
}
