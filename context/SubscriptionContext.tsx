import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  INACTIVE_ENTITLEMENT,
  endSubscriptions,
  initSubscriptions,
  isEntitlementValid,
  isStoreAvailable,
  loadEntitlement,
  reconcilePendingTransactions,
  refreshEntitlement,
  restoreNoirPlus,
  saveEntitlement,
  type NoirEntitlement,
} from "../services/subscription";
import { useAuth } from "./AuthContext";

type SubscriptionContextValue = {
  entitlement: NoirEntitlement;
  /** The only flag any screen should gate the full reading on. */
  isNoirPlus: boolean;
  /** True until the first entitlement resolution finishes. */
  loading: boolean;
  refresh: () => Promise<NoirEntitlement>;
  restore: () => Promise<NoirEntitlement>;
  /** Adopt an entitlement produced by a completed purchase. */
  applyEntitlement: (entitlement: NoirEntitlement) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  entitlement: INACTIVE_ENTITLEMENT,
  isNoirPlus: false,
  loading: true,
  refresh: async () => INACTIVE_ENTITLEMENT,
  restore: async () => INACTIVE_ENTITLEMENT,
  applyEntitlement: () => undefined,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [entitlement, setEntitlement] = useState<NoirEntitlement>(INACTIVE_ENTITLEMENT);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Open the billing connection once for the life of the app.
  useEffect(() => {
    if (!isStoreAvailable()) return;
    initSubscriptions().catch(error => {
      if (__DEV__) console.warn("NOIR: StoreKit connection failed.", error);
    });
    return () => {
      endSubscriptions().catch(() => undefined);
    };
  }, []);

  const resolve = useCallback(async (): Promise<NoirEntitlement> => {
    if (!user) {
      if (mounted.current) {
        setEntitlement(INACTIVE_ENTITLEMENT);
        setLoading(false);
      }
      return INACTIVE_ENTITLEMENT;
    }

    // Show the cached value first so a signed-in NOIR+ user never sees a
    // locked screen flash while StoreKit is queried.
    const cached = await loadEntitlement().catch(() => INACTIVE_ENTITLEMENT);
    if (mounted.current && isEntitlementValid(cached)) setEntitlement(cached);

    try {
      // Finish anything StoreKit redelivered before trusting the entitlement.
      await reconcilePendingTransactions().catch(() => undefined);

      const fresh = await refreshEntitlement();
      if (mounted.current) setEntitlement(fresh);
      return fresh;
    } catch (error) {
      if (__DEV__) console.warn("NOIR: entitlement resolution failed.", error);
      // Fall back to the cache rather than silently downgrading the user.
      return cached;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    resolve();
  }, [authLoading, resolve]);

  // A subscription can lapse, renew or be cancelled outside the app.
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state === "active" && user) resolve();
    });
    return () => sub.remove();
  }, [resolve, user]);

  const restore = useCallback(async () => {
    const restored = await restoreNoirPlus();
    if (mounted.current) setEntitlement(restored);
    return restored;
  }, []);

  const applyEntitlement = useCallback((next: NoirEntitlement) => {
    setEntitlement(next);
    saveEntitlement(next).catch(() => undefined);
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      entitlement,
      isNoirPlus: isEntitlementValid(entitlement),
      loading,
      refresh: resolve,
      restore,
      applyEntitlement,
    }),
    [entitlement, loading, resolve, restore, applyEntitlement],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
