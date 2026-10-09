import { getNoirProfile, isProfileComplete } from "../firebase/profile";
import { getSavedReading, hasReadingContent } from "./reading";
import { isEntitlementValid, refreshEntitlement } from "./subscription";

export type NoirEntryRoute = "/onboarding" | "/generate" | "/paywall" | "/home";

/**
 * Where a signed-in user belongs right now.
 *
 * This is the single definition of NOIR's resume behaviour, shared by the
 * launch screen, the sign-in screen and account creation, so the three can
 * never disagree about the flow:
 *
 *   no birth info      -> onboarding
 *   NOIR+ active       -> home
 *   preview not built  -> generate
 *   preview built      -> paywall
 *
 * @param knownEntitlement pass the value already resolved by SubscriptionContext
 *                        to avoid a second StoreKit round-trip.
 */
export async function resolvePostAuthRoute(
  knownEntitlement?: boolean,
): Promise<NoirEntryRoute> {
  const profile = await getNoirProfile();
  if (!isProfileComplete(profile)) return "/onboarding";

  const entitled =
    knownEntitlement ?? isEntitlementValid(await refreshEntitlement().catch(() => null));
  if (entitled) return "/home";

  const preview = await getSavedReading("previewReading").catch(() => null);
  return hasReadingContent(preview) ? "/paywall" : "/generate";
}
