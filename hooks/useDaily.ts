import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import {
  dateKey,
  ensureTodayReading,
  getDailyEntry,
  listRecentDaily,
  saveReflection,
  streakFrom,
  type DailyEntry,
} from "../services/daily";

/**
 * Today's reading.
 *
 * `autoGenerate` is the difference between glancing and opening: Home reads
 * whatever already exists (never spending a model call for a screen the user
 * only scrolled past), while the Daily screen generates on open.
 */
export function useToday(autoGenerate: boolean) {
  const { user, loading: authLoading } = useAuth();
  const { isNoirPlus, loading: subscriptionLoading } = useSubscription();

  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || subscriptionLoading) return;

    if (!user || !isNoirPlus) {
      setEntry(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const existing = await getDailyEntry(dateKey());
        if (!alive || !mounted.current) return;

        if (existing) {
          setEntry(existing);
          return;
        }

        if (!autoGenerate) {
          setEntry(null);
          return;
        }

        setGenerating(true);
        const created = await ensureTodayReading();
        if (alive && mounted.current) setEntry(created);
      } catch (e) {
        if (alive && mounted.current) {
          setError((e as Error)?.message || "Today's reading could not be opened.");
        }
      } finally {
        if (alive && mounted.current) {
          setGenerating(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, authLoading, isNoirPlus, subscriptionLoading, autoGenerate, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  const submitReflection = useCallback(
    async (text: string) => {
      if (!entry) return;
      await saveReflection(entry.date, text);
      if (mounted.current) {
        setEntry(current =>
          current ? { ...current, reflection: text.trim(), reflectionUpdatedAt: Date.now() } : current,
        );
      }
    },
    [entry],
  );

  return { entry, loading, generating, error, reload, submitReflection };
}

export function useDailyHistory(limit = 30) {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    listRecentDaily(limit)
      .then(result => {
        if (alive) setEntries(result);
      })
      .catch((e: unknown) => {
        if (alive) setError((e as Error)?.message || "Your journal could not be loaded.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user, authLoading, limit, nonce]);

  return {
    entries,
    streak: streakFrom(entries),
    loading,
    error,
    reload: useCallback(() => setNonce(n => n + 1), []),
  };
}
