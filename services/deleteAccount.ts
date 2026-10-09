import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { reauthenticate } from "./auth";
import { cancelDailyReminder } from "./notifications";

/**
 * Permanent account deletion — App Store Review Guideline 5.1.1(v).
 *
 * The order is load-bearing:
 *
 *   1. Re-authenticate     Firebase refuses to delete a user whose credential is
 *                          more than a few minutes old.
 *   2. Revoke Apple token  Apple asks Sign in with Apple apps to revoke the token
 *                          on deletion, otherwise NOIR stays listed under the
 *                          person's Apple ID. Needs a live session, so it must
 *                          run before the user is deleted. BEST-EFFORT: it only
 *                          works once the Apple provider in Firebase Console has
 *                          its Team ID / Key ID / private key, and a failure here
 *                          must never stop the deletion itself — an account the
 *                          person cannot delete is the worse outcome, and the
 *                          one App Review rejects for.
 *   3. Cancel reminders    Local notifications live on the device and would keep
 *                          firing for an account that no longer exists.
 *   4. Delete Firestore    The rules only allow the signed-in owner to delete,
 *                          so this must happen while the login still exists.
 *   5. Delete the login    Last, because after this the client has no rights.
 *
 * Nothing is destroyed until step 1 succeeds, so a cancelled sign-in prompt
 * leaves the account completely intact.
 */

export type DeletionStep = "verifying" | "revoking" | "erasing" | "closing" | "done";

const BATCH_LIMIT = 450; // Firestore caps a batch at 500 writes.

async function deleteCollection(path: FirebaseFirestoreTypes.CollectionReference) {
  // Subcollections are NOT removed when their parent document is deleted, so
  // the daily readings and journal entries have to be cleared explicitly.
  for (;;) {
    const snap = await path.limit(BATCH_LIMIT).get();
    if (snap.empty) return;
    const batch = firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < BATCH_LIMIT) return;
  }
}

export type DeletionResult = {
  /**
   * null  — not a Sign in with Apple account, nothing to revoke.
   * true  — NOIR was removed from the person's Apple ID.
   * false — revocation failed; the person can remove it themselves in
   *         iOS Settings, and the UI tells them how.
   */
  appleLinkRevoked: boolean | null;
};

export async function deleteNoirAccount(
  options: { password?: string; onStep?: (step: DeletionStep) => void } = {},
): Promise<DeletionResult> {
  const { password, onStep } = options;
  const user = auth().currentUser;
  if (!user) throw new Error("You are not signed in.");
  const uid = user.uid;

  onStep?.("verifying");
  const { appleAuthorizationCode } = await reauthenticate(password);

  let appleLinkRevoked: boolean | null = null;
  if (appleAuthorizationCode) {
    onStep?.("revoking");
    try {
      await auth().revokeToken(appleAuthorizationCode);
      appleLinkRevoked = true;
    } catch (error) {
      appleLinkRevoked = false;
      if (__DEV__) {
        console.warn(
          "NOIR: Apple token revocation failed. Check the Apple provider's Team ID, Key ID " +
            "and private key in Firebase Console → Authentication → Sign-in method.",
          error,
        );
      }
    }
  }

  onStep?.("erasing");
  await cancelDailyReminder().catch(() => undefined);

  const userDoc = firestore().collection("users").doc(uid);
  await deleteCollection(userDoc.collection("dailyReadings"));
  await userDoc.delete();

  onStep?.("closing");
  await user.delete();

  // Clear the cached Google session so the next sign-in starts fresh.
  try {
    await GoogleSignin.signOut();
  } catch {
    // No Google session — nothing to clear.
  }

  onStep?.("done");
  return { appleLinkRevoked };
}
