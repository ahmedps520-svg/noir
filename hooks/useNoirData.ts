import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getNoirProfile, type NoirProfile } from "../firebase/profile";
import { getSavedReading, type NoirReading } from "../services/reading";
import { chartFromBirthData, type NatalChart } from "../services/chart";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
};

/**
 * Small loader shared by the screens that read the user's saved NOIR data.
 * Re-runs whenever the signed-in user changes so a sign-out never leaves the
 * previous account's reading on screen.
 */
function useFirestoreResource<T>(
  load: () => Promise<T | null>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
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
    if (authLoading) return;

    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError("");

    load()
      .then(result => {
        if (alive && mounted.current) setData(result);
      })
      .catch((e: unknown) => {
        if (alive && mounted.current) {
          setError((e as Error)?.message || "NOIR could not load your data.");
        }
      })
      .finally(() => {
        if (alive && mounted.current) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, nonce, ...deps]);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  return { data, loading, error, reload };
}

export function useNoirProfile(): AsyncState<NoirProfile> {
  return useFirestoreResource<NoirProfile>(() => getNoirProfile(), []);
}

export function useNoirReading(kind: "previewReading" | "fullReading"): AsyncState<NoirReading> {
  return useFirestoreResource<NoirReading>(() => getSavedReading(kind), [kind]);
}

/** The person's natal chart, derived from their stored birth data. */
export function useNatalChart(): { chart: NatalChart | null; loading: boolean } {
  const { data: profile, loading } = useNoirProfile();
  const chart = useMemo(
    () =>
      profile
        ? chartFromBirthData({
            birthDate: profile.birthDate,
            birthTime: profile.birthTime,
            latitude: profile.birthLatitude,
            longitude: profile.birthLongitude,
            timezone: profile.birthTimezone,
          })
        : null,
    [profile],
  );
  return { chart, loading };
}
