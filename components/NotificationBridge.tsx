import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { isSupported, syncReminder } from "../services/notifications";

/**
 * Renders nothing. Lives inside the providers so it can read entitlement, and
 * owns the two jobs that must happen app-wide rather than on a screen:
 *
 *   1. opening the Daily screen when a reminder is tapped, including from cold
 *      start, where the tap happened before any listener existed;
 *   2. reconciling the OS notification schedule with the stored preference
 *      whenever the user or their entitlement changes.
 */
export default function NotificationBridge() {
  const { user, loading: authLoading } = useAuth();
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();
  const handledColdStart = useRef(false);

  // Tap handling.
  useEffect(() => {
    if (!isSupported()) return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const route = response?.notification.request.content.data?.route;
      if (typeof route === "string" && route.startsWith("/")) {
        // The navigator may not have mounted yet on a cold start.
        setTimeout(() => router.push(route as "/daily"), 0);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then(response => {
          if (response) open(response);
        })
        .catch(() => undefined);
    }

    return () => subscription.remove();
  }, []);

  // Keep the schedule honest: cancel it if NOIR+ lapses, restore it if the
  // preference says on but the device has nothing scheduled (fresh install).
  useEffect(() => {
    if (authLoading || subscriptionLoading) return;
    if (!user) return;

    syncReminder(isNoirPlus).catch(error => {
      if (__DEV__) console.warn("NOIR: reminder sync failed.", error);
    });
  }, [user, authLoading, isNoirPlus, subscriptionLoading]);

  return null;
}
