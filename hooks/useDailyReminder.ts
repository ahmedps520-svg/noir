import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  DEFAULT_REMINDER,
  disableReminder,
  enableReminder,
  getPermissionStatus,
  isSupported,
  loadReminderPreference,
  scheduleDailyReminder,
  saveReminderPreference,
  type ReminderPreference,
} from "../services/notifications";

export function useDailyReminder() {
  const { user, loading: authLoading } = useAuth();
  const [preference, setPreference] = useState<ReminderPreference>(DEFAULT_REMINDER);
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let alive = true;
    Promise.all([loadReminderPreference(), getPermissionStatus()])
      .then(([stored, status]) => {
        if (!alive || !mounted.current) return;
        setPreference(stored);
        setPermission(status);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive && mounted.current) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  const toggle = useCallback(
    async (next: boolean) => {
      setBusy(true);
      try {
        const result = next
          ? await enableReminder(preference.hour, preference.minute)
          : await disableReminder(preference.hour, preference.minute);
        if (mounted.current) {
          setPreference(result);
          setPermission(await getPermissionStatus());
        }
        return result;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [preference.hour, preference.minute],
  );

  /** Move the reminder. Re-schedules immediately when it is already on. */
  const setTime = useCallback(
    async (hour: number, minute: number) => {
      const next: ReminderPreference = { ...preference, hour, minute };
      if (mounted.current) setPreference(next);

      await saveReminderPreference(next).catch(() => undefined);
      if (next.enabled && isSupported()) {
        await scheduleDailyReminder(hour, minute).catch(() => undefined);
      }
    },
    [preference],
  );

  return { preference, permission, loading, busy, toggle, setTime, supported: isSupported() };
}
