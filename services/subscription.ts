import { Platform } from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import {
  ErrorCode,
  endConnection,
  fetchProducts,
  finishTransaction,
  getActiveSubscriptions,
  getStorefront,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ActiveSubscription,
  type Purchase,
  type PurchaseError,
} from "expo-iap";
import {
  deepLinkToSubscriptionsIOS,
  getPendingTransactionsIOS,
  isTransactionVerifiedIOS,
} from "expo-iap";
import {
  DEV_MOCK_PURCHASE_ENABLED,
  NOIR_PLUS_FALLBACK_PRICING,
  NOIR_PLUS_PRODUCTS,
  NOIR_PLUS_PRODUCT_IDS,
} from "../constants/config";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type NoirPlan = "monthly" | "weekly";

export type NoirEntitlement = {
  active: boolean;
  productId: string | null;
  plan: NoirPlan | null;
  /** Epoch ms. Null means StoreKit did not report an expiry (treat as active). */
  expiresAt: number | null;
  autoRenewing: boolean;
  /** "Sandbox" | "Production" | null — reported by StoreKit 2 on iOS. */
  environment: string | null;
  /**
   * Where this entitlement came from. "dev-mock" entitlements are rejected
   * outside __DEV__ so a simulated purchase can never unlock NOIR+ in a
   * release build.
   */
  source: "storekit" | "dev-mock";
  transactionId: string | null;
  updatedAt: number;
};

export const INACTIVE_ENTITLEMENT: NoirEntitlement = {
  active: false,
  productId: null,
  plan: null,
  expiresAt: null,
  autoRenewing: false,
  environment: null,
  source: "storekit",
  transactionId: null,
  updatedAt: 0,
};

export type NoirPlusOffer = {
  plan: NoirPlan;
  productId: string;
  /**
   * Price already localized by StoreKit to the user's App Store storefront —
   * "£6.99", "SAR 29.99", "¥1,200". NOIR never formats or converts a price
   * itself; Apple sets per-country pricing from the tier table, so any
   * conversion NOIR did would be wrong. Empty when the store is unreachable.
   */
  displayPrice: string;
  /** ISO currency code from StoreKit, e.g. "GBP", "SAR". Null when unknown. */
  currency: string | null;
  period: string;
  title: string;
  description: string;
  /** True when App Store Connect reports an introductory free trial. */
  hasFreeTrial: boolean;
  trialLabel: string | null;
  /** False when this came from local fallback copy rather than StoreKit. */
  fromStore: boolean;
};

export class SubscriptionCancelledError extends Error {
  constructor() {
    super("Purchase cancelled.");
    this.name = "SubscriptionCancelledError";
  }
}

/* ------------------------------------------------------------------ *
 * Entitlement validity
 * ------------------------------------------------------------------ */

export function planForProductId(productId: string | null | undefined): NoirPlan | null {
  if (productId === NOIR_PLUS_PRODUCTS.monthly) return "monthly";
  if (productId === NOIR_PLUS_PRODUCTS.weekly) return "weekly";
  return null;
}

/**
 * The single source of truth for "is NOIR+ unlocked right now".
 *
 * Every gate in the app funnels through this so the full reading cannot be
 * unlocked by a button press, a stale Firestore write, or a dev mock in a
 * release build.
 */
export function isEntitlementValid(entitlement: NoirEntitlement | null | undefined): boolean {
  if (!entitlement || !entitlement.active) return false;
  if (entitlement.source === "dev-mock" && !__DEV__) return false;
  if (entitlement.expiresAt !== null && entitlement.expiresAt <= Date.now()) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * StoreKit connection
 * ------------------------------------------------------------------ */

let connectionPromise: Promise<boolean> | null = null;

export function isStoreAvailable() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export async function initSubscriptions(): Promise<boolean> {
  if (!isStoreAvailable()) return false;
  if (!connectionPromise) {
    connectionPromise = initConnection().catch(error => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

export async function endSubscriptions() {
  if (!connectionPromise) return;
  connectionPromise = null;
  try {
    await endConnection();
  } catch {
    // Tearing down a already-closed connection is not an error worth surfacing.
  }
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

/**
 * Shown only when StoreKit is unreachable.
 *
 * Deliberately carries NO price. The previous version hardcoded "$7.99", which
 * is simply wrong for anyone outside the US storefront — and NOIR cannot derive
 * a local price, because Apple sets each country's price from its own tier
 * table rather than by converting USD. Better to show no number than a number
 * we would not charge.
 */
function fallbackOffers(): NoirPlusOffer[] {
  return [
    {
      plan: "monthly",
      productId: NOIR_PLUS_PRODUCTS.monthly,
      displayPrice: "",
      currency: null,
      period: NOIR_PLUS_FALLBACK_PRICING.monthly.period,
      title: "NOIR+ Monthly",
      description: "Your complete personalized reading, renewed monthly.",
      hasFreeTrial: true,
      trialLabel: `${NOIR_PLUS_FALLBACK_PRICING.trialDays} days free`,
      fromStore: false,
    },
    {
      plan: "weekly",
      productId: NOIR_PLUS_PRODUCTS.weekly,
      displayPrice: "",
      currency: null,
      period: NOIR_PLUS_FALLBACK_PRICING.weekly.period,
      title: "NOIR+ Weekly",
      description: "Your complete personalized reading, renewed weekly.",
      hasFreeTrial: false,
      trialLabel: null,
      fromStore: false,
    },
  ];
}

/** ISO country code of the user's App Store account, e.g. "GB", "SA". */
export async function getStorefrontCountry(): Promise<string | null> {
  if (!isStoreAvailable()) return null;
  try {
    await initSubscriptions();
    const code = await getStorefront();
    return code ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

type RawStoreProduct = {
  id?: string;
  currency?: string;
  title?: string;
  description?: string;
  displayPrice?: string;
  subscriptionPeriodUnitIOS?: string | null;
  subscriptionPeriodNumberIOS?: string | null;
  introductoryPricePaymentModeIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | null;
  introductoryPriceSubscriptionPeriodIOS?: string | null;
};

function describeTrial(product: RawStoreProduct): { hasFreeTrial: boolean; trialLabel: string | null } {
  if (product.introductoryPricePaymentModeIOS !== "free-trial") {
    return { hasFreeTrial: false, trialLabel: null };
  }
  const count = Number(product.introductoryPriceNumberOfPeriodsIOS ?? 0);
  const unit = product.introductoryPriceSubscriptionPeriodIOS ?? "";
  if (!count || !unit || unit === "empty") {
    return { hasFreeTrial: true, trialLabel: "Free trial" };
  }
  return {
    hasFreeTrial: true,
    trialLabel: `${count} ${unit}${count === 1 ? "" : "s"} free`,
  };
}

/**
 * Fetch the real NOIR+ products. Falls back to local copy so the paywall can
 * still render if StoreKit is unreachable — `fromStore` tells the UI which it
 * got, and purchase is disabled for fallback offers.
 */
export async function fetchNoirPlusOffers(): Promise<NoirPlusOffer[]> {
  if (!isStoreAvailable()) return fallbackOffers();

  try {
    await initSubscriptions();
    const products = (await fetchProducts({
      skus: NOIR_PLUS_PRODUCT_IDS,
      type: "subs",
    })) as RawStoreProduct[] | null;

    if (!products || products.length === 0) return fallbackOffers();

    const offers = products
      .map((product): NoirPlusOffer | null => {
        const plan = planForProductId(product.id);
        if (!plan || !product.id) return null;
        const trial = describeTrial(product);
        const unit = product.subscriptionPeriodUnitIOS;
        return {
          plan,
          productId: product.id,
          displayPrice: product.displayPrice ?? "",
          currency: product.currency ?? null,
          period: unit && unit !== "empty" ? unit : plan === "monthly" ? "month" : "week",
          title: product.title ?? (plan === "monthly" ? "NOIR+ Monthly" : "NOIR+ Weekly"),
          description: product.description ?? "",
          hasFreeTrial: trial.hasFreeTrial,
          trialLabel: trial.trialLabel,
          fromStore: true,
        };
      })
      .filter((offer): offer is NoirPlusOffer => offer !== null);

    if (offers.length === 0) return fallbackOffers();

    // Monthly first — it is the plan NOIR leads with.
    offers.sort((a, b) => (a.plan === "monthly" ? -1 : b.plan === "monthly" ? 1 : 0));
    return offers;
  } catch (error) {
    if (__DEV__) console.warn("NOIR: could not load NOIR+ products from StoreKit.", error);
    return fallbackOffers();
  }
}

/* ------------------------------------------------------------------ *
 * Entitlement <-> StoreKit
 * ------------------------------------------------------------------ */

function entitlementFromActiveSubscription(sub: ActiveSubscription): NoirEntitlement {
  return {
    active: sub.isActive,
    productId: sub.productId,
    plan: planForProductId(sub.productId),
    expiresAt: sub.expirationDateIOS ?? null,
    autoRenewing: sub.autoRenewingAndroid ?? true,
    environment: sub.environmentIOS ?? null,
    source: "storekit",
    transactionId: sub.transactionId ?? null,
    updatedAt: Date.now(),
  };
}

/**
 * Ask StoreKit what the user actually owns. This is the authority — Firestore
 * is only a cache so the app can render instantly on cold start.
 */
export async function readEntitlementFromStore(): Promise<NoirEntitlement> {
  if (!isStoreAvailable()) return INACTIVE_ENTITLEMENT;

  await initSubscriptions();
  const active = await getActiveSubscriptions(NOIR_PLUS_PRODUCT_IDS);

  const match = active.find(sub => sub.isActive && planForProductId(sub.productId) !== null);
  if (!match) return { ...INACTIVE_ENTITLEMENT, updatedAt: Date.now() };

  return entitlementFromActiveSubscription(match);
}

/* ------------------------------------------------------------------ *
 * Firestore persistence
 * ------------------------------------------------------------------ */

function entitlementDoc(uid: string) {
  return firestore().collection("users").doc(uid);
}

export async function saveEntitlement(entitlement: NoirEntitlement) {
  const user = auth().currentUser;
  if (!user) return;
  await entitlementDoc(user.uid).set(
    {
      noirPlus: entitlement,
      noirPlusUpdatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadEntitlement(): Promise<NoirEntitlement> {
  const user = auth().currentUser;
  if (!user) return INACTIVE_ENTITLEMENT;

  const snap = await entitlementDoc(user.uid).get();
  const stored = snap.data()?.noirPlus as Partial<NoirEntitlement> | undefined;
  if (!stored) return INACTIVE_ENTITLEMENT;

  return {
    active: Boolean(stored.active),
    productId: stored.productId ?? null,
    plan: stored.plan ?? planForProductId(stored.productId),
    expiresAt: typeof stored.expiresAt === "number" ? stored.expiresAt : null,
    autoRenewing: Boolean(stored.autoRenewing),
    environment: stored.environment ?? null,
    source: stored.source === "dev-mock" ? "dev-mock" : "storekit",
    transactionId: stored.transactionId ?? null,
    updatedAt: typeof stored.updatedAt === "number" ? stored.updatedAt : 0,
  };
}

/**
 * Cold-start resolution: show the cached entitlement immediately, then correct
 * it against StoreKit. Never let the cache upgrade a user — only StoreKit can.
 */
export async function refreshEntitlement(): Promise<NoirEntitlement> {
  const cached = await loadEntitlement().catch(() => INACTIVE_ENTITLEMENT);

  if (!isStoreAvailable()) return cached;

  try {
    const fromStore = await readEntitlementFromStore();

    // A dev mock is only ever trusted in __DEV__, and only when StoreKit itself
    // has nothing to say.
    if (!fromStore.active && cached.source === "dev-mock" && __DEV__ && cached.active) {
      return cached;
    }

    if (
      fromStore.active !== cached.active ||
      fromStore.productId !== cached.productId ||
      fromStore.expiresAt !== cached.expiresAt
    ) {
      await saveEntitlement(fromStore).catch(() => undefined);
    }

    return fromStore;
  } catch (error) {
    if (__DEV__) console.warn("NOIR: StoreKit entitlement refresh failed, using cache.", error);
    return cached;
  }
}

/* ------------------------------------------------------------------ *
 * Purchase
 * ------------------------------------------------------------------ */

/**
 * Set while purchaseNoirPlus() owns the transaction stream, so background
 * reconciliation does not finish a transaction out from under it.
 */
let purchaseInFlight = false;

async function isPurchaseVerified(purchase: Purchase): Promise<boolean> {
  if (purchase.purchaseState === "failed") return false;

  if (Platform.OS === "ios") {
    try {
      const verified = await isTransactionVerifiedIOS(purchase.productId);
      if (!verified) return false;
    } catch {
      // Fall through to the state/token check below rather than hard-failing a
      // purchase Apple already accepted.
    }
  }

  return purchase.purchaseState === "purchased" || purchase.purchaseState === "restored";
}

/**
 * Run the real StoreKit purchase and resolve only once Apple has confirmed the
 * transaction and StoreKit reports the entitlement as active.
 *
 * expo-iap delivers the final purchase state through events rather than the
 * requestPurchase() promise, so this bridges the two.
 */
export async function purchaseNoirPlus(productId: string): Promise<NoirEntitlement> {
  if (!isStoreAvailable()) {
    throw new Error("Subscriptions are only available on iOS and Android.");
  }

  await initSubscriptions();
  purchaseInFlight = true;

  return new Promise<NoirEntitlement>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      purchaseInFlight = false;
      updateSub.remove();
      errorSub.remove();
      clearTimeout(timeout);
    };

    const succeed = (entitlement: NoirEntitlement) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(entitlement);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const updateSub = purchaseUpdatedListener(async purchase => {
      if (purchase.productId !== productId) return;

      try {
        if (purchase.purchaseState === "pending" || purchase.purchaseState === "deferred") {
          // Ask-to-Buy / SCA. Leave the listener attached and let it settle.
          return;
        }

        const verified = await isPurchaseVerified(purchase);
        if (!verified) {
          fail(new Error("Apple could not verify this purchase."));
          return;
        }

        // Only finish once verified — an unfinished transaction is redelivered
        // by StoreKit, which is the behaviour we want if anything above threw.
        await finishTransaction({ purchase, isConsumable: false });

        const entitlement = await readEntitlementFromStore();
        if (!entitlement.active) {
          fail(new Error("Apple confirmed the purchase but NOIR+ is not active yet."));
          return;
        }

        await saveEntitlement(entitlement).catch(() => undefined);
        succeed(entitlement);
      } catch (error) {
        fail(error instanceof Error ? error : new Error("The purchase could not be completed."));
      }
    });

    const errorSub = purchaseErrorListener(error => {
      if (error.productId && error.productId !== productId) return;
      if (error.code === ErrorCode.UserCancelled) {
        fail(new SubscriptionCancelledError());
        return;
      }
      fail(new Error(describePurchaseError(error)));
    });

    // Guard against a purchase sheet that never resolves either way.
    const timeout = setTimeout(() => {
      fail(new Error("The App Store did not respond. Please try again."));
    }, 1000 * 60 * 3);

    requestPurchaseSubscription(productId).catch(error => {
      const code = (error as PurchaseError)?.code;
      if (code === ErrorCode.UserCancelled) {
        fail(new SubscriptionCancelledError());
        return;
      }
      fail(error instanceof Error ? error : new Error("The App Store could not start the purchase."));
    });
  });
}

async function requestPurchaseSubscription(productId: string) {
  await requestPurchase({
    type: "subs",
    request: {
      apple: { sku: productId },
      google: { skus: [productId] },
    },
  });
}

/**
 * StoreKit redelivers any transaction that was never finished — after a crash,
 * an interrupted purchase, or a renewal that arrived while the app was closed.
 * Nothing else would finish those, so reconcile them once at launch.
 *
 * Skipped while a purchase is in flight, because purchaseNoirPlus() owns the
 * transaction for the product it is buying.
 */
export async function reconcilePendingTransactions(): Promise<NoirEntitlement | null> {
  if (Platform.OS !== "ios" || purchaseInFlight) return null;

  await initSubscriptions();
  const pending = await getPendingTransactionsIOS();
  if (!pending || pending.length === 0) return null;

  let finishedAny = false;
  for (const purchase of pending) {
    if (purchaseInFlight) break;
    try {
      if (!(await isPurchaseVerified(purchase))) continue;
      await finishTransaction({ purchase, isConsumable: false });
      finishedAny = true;
    } catch (error) {
      if (__DEV__) console.warn("NOIR: could not finish a pending transaction.", error);
    }
  }

  if (!finishedAny) return null;

  const entitlement = await readEntitlementFromStore();
  await saveEntitlement(entitlement).catch(() => undefined);
  return entitlement;
}

export function describePurchaseError(error: PurchaseError | { code?: string; message?: string }): string {
  switch (error.code) {
    case ErrorCode.UserCancelled:
      return "Purchase cancelled.";
    case ErrorCode.ItemUnavailable:
      return "This NOIR+ plan isn't available in your region yet.";
    case ErrorCode.AlreadyOwned:
      return "You already have NOIR+. Try Restore Purchases.";
    case ErrorCode.NetworkError:
      return "NOIR couldn't reach the App Store. Check your connection.";
    case ErrorCode.DeferredPayment:
    case ErrorCode.Pending:
      return "Your purchase is pending approval.";
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
      return "In-app purchases are unavailable on this device.";
    case ErrorCode.PurchaseVerificationFailed:
      return "Apple could not verify this purchase.";
    default:
      return error.message || "The purchase could not be completed.";
  }
}

/* ------------------------------------------------------------------ *
 * Restore & manage
 * ------------------------------------------------------------------ */

export async function restoreNoirPlus(): Promise<NoirEntitlement> {
  if (!isStoreAvailable()) throw new Error("Restoring purchases requires iOS or Android.");

  await initSubscriptions();
  await restorePurchases();

  const entitlement = await readEntitlementFromStore();
  await saveEntitlement(entitlement).catch(() => undefined);
  return entitlement;
}

export async function openManageSubscriptions() {
  if (Platform.OS !== "ios") return;
  await deepLinkToSubscriptionsIOS();
}

/* ------------------------------------------------------------------ *
 * Development-only simulated purchase
 * ------------------------------------------------------------------ */

/**
 * Grants a clearly-tagged fake entitlement so the post-purchase flow can be
 * exercised without a StoreKit sandbox account.
 *
 * Guarded three ways: the build must be __DEV__, DEV_MOCK_PURCHASE_ENABLED must
 * be switched on by hand, and the resulting entitlement is tagged "dev-mock" so
 * `isEntitlementValid()` refuses it in any release build.
 */
export async function grantDevMockEntitlement(plan: NoirPlan): Promise<NoirEntitlement> {
  if (!__DEV__ || !DEV_MOCK_PURCHASE_ENABLED) {
    throw new Error("Simulated purchases are disabled in this build.");
  }

  const entitlement: NoirEntitlement = {
    active: true,
    productId: NOIR_PLUS_PRODUCTS[plan],
    plan,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 3,
    autoRenewing: false,
    environment: "DevMock",
    source: "dev-mock",
    transactionId: `dev-mock-${Date.now()}`,
    updatedAt: Date.now(),
  };

  await saveEntitlement(entitlement);
  return entitlement;
}
