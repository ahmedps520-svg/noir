import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

/**
 * The NOIR user document lives at users/{uid} and holds everything the app
 * needs to rebuild the experience on a new device: onboarding answers, birth
 * information, the generated readings and the NOIR+ entitlement.
 */
export type NoirProfile = {
  displayName: string | null;
  email: string | null;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  /** From the birthplace search. Null on accounts created before it existed. */
  birthLatitude: number | null;
  birthLongitude: number | null;
  birthTimezone: string | null;
  onboardingAnswers: string[];
};

export const EMPTY_PROFILE: NoirProfile = {
  displayName: null,
  email: null,
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  birthLatitude: null,
  birthLongitude: null,
  birthTimezone: null,
  onboardingAnswers: [],
};

export async function saveUserProfile(uid: string, profile: Record<string, unknown>) {
  await firestore().collection("users").doc(uid).set(
    {
      ...profile,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Onboarding answers were originally written as a JSON string and are now
 * written as a real array. Read both so existing accounts keep working.
 */
export function normalizeAnswers(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON — fall through to empty.
    }
  }
  return [];
}

export async function saveNoirProfile(profile: Partial<NoirProfile> & { aiConsentAt?: string }) {
  const user = auth().currentUser;
  if (!user) throw new Error("Sign in before saving your NOIR profile.");

  await saveUserProfile(user.uid, {
    ...profile,
    email: profile.email ?? user.email ?? null,
    displayName: profile.displayName ?? user.displayName ?? null,
  });
}

export async function getNoirProfile(): Promise<NoirProfile | null> {
  const user = auth().currentUser;
  if (!user) return null;

  const snap = await firestore().collection("users").doc(user.uid).get();
  const data = snap.data();
  if (!data) return null;

  return {
    displayName: (data.displayName as string | null) ?? user.displayName ?? null,
    email: (data.email as string | null) ?? user.email ?? null,
    birthDate: String(data.birthDate ?? ""),
    birthTime: String(data.birthTime ?? ""),
    birthPlace: String(data.birthPlace ?? ""),
    birthLatitude: typeof data.birthLatitude === "number" ? data.birthLatitude : null,
    birthLongitude: typeof data.birthLongitude === "number" ? data.birthLongitude : null,
    birthTimezone: typeof data.birthTimezone === "string" ? data.birthTimezone : null,
    onboardingAnswers: normalizeAnswers(data.onboardingAnswers),
  };
}

export function isProfileComplete(profile: NoirProfile | null): profile is NoirProfile {
  return Boolean(
    profile &&
      profile.birthDate.trim() &&
      profile.birthTime.trim() &&
      profile.birthPlace.trim(),
  );
}
