import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { GOOGLE_WEB_CLIENT_ID } from "../constants/config";

export type NoirSignInResult = {
  user: FirebaseAuthTypes.User;
  /** Apple/Google only return a display name on the very first sign-in. */
  fullName: string | null;
  isNewUser: boolean;
};

let googleConfigured = false;

export function configureGoogle() {
  if (googleConfigured) return;
  // On iOS the client id is read from GoogleService-Info.plist. Only pass
  // webClientId when one is configured (needed for Android / server auth code).
  GoogleSignin.configure(
    GOOGLE_WEB_CLIENT_ID ? { webClientId: GOOGLE_WEB_CLIENT_ID } : {},
  );
  googleConfigured = true;
}

function toResult(
  credential: FirebaseAuthTypes.UserCredential,
  fullName: string | null,
): NoirSignInResult {
  return {
    user: credential.user,
    fullName: fullName || credential.user.displayName || null,
    isNewUser: Boolean(credential.additionalUserInfo?.isNewUser),
  };
}

export async function signInWithGoogle(): Promise<NoirSignInResult> {
  configureGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error("Google sign-in was cancelled.");

  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);
  return toResult(userCredential, result.data?.user?.name ?? null);
}

export async function signInWithApple(): Promise<NoirSignInResult> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error("Apple Sign-In is not available on this device.");

  const response = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!response.identityToken) throw new Error("Apple did not return an identity token.");

  const credential = auth.AppleAuthProvider.credential(
    response.identityToken,
    response.authorizationCode || undefined,
  );

  const userCredential = await auth().signInWithCredential(credential);

  // Apple only sends the name on the first authorization, so persist it now.
  const appleName = [response.fullName?.givenName, response.fullName?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (appleName && !userCredential.user.displayName) {
    try {
      await userCredential.user.updateProfile({ displayName: appleName });
    } catch {
      // A failed cosmetic name update must not block sign-in.
    }
  }

  return toResult(userCredential, appleName || null);
}

export async function createEmailAccount(
  email: string,
  password: string,
): Promise<NoirSignInResult> {
  const credential = await auth().createUserWithEmailAndPassword(email.trim(), password);
  return toResult(credential, null);
}

export async function signInEmail(
  email: string,
  password: string,
): Promise<NoirSignInResult> {
  const credential = await auth().signInWithEmailAndPassword(email.trim(), password);
  return toResult(credential, null);
}

export async function sendPasswordReset(email: string) {
  await auth().sendPasswordResetEmail(email.trim());
}

export async function signOutNoir() {
  await auth().signOut();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google session may not exist; Firebase sign-out is what matters.
  }
}

/**
 * Firebase error codes are not presentable. Map the ones a NOIR user can
 * realistically hit onto plain language.
 */
export function describeAuthError(error: unknown): string {
  const code = String((error as { code?: string })?.code ?? "");
  const message = String((error as { message?: string })?.message ?? "");

  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has a NOIR account. Sign in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That email and password don't match.";
    case "auth/user-not-found":
      return "No NOIR account exists for that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "NOIR couldn't reach the network. Check your connection.";
    case "auth/requires-recent-login":
      return "For your security, confirm it's you again, then try once more.";
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled for NOIR yet.";
    default:
      break;
  }

  if (/cancel/i.test(message)) return "Sign-in was cancelled.";
  return message.replace(/^\[.*?\]\s*/, "").replace("Firebase: ", "") || "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------ *
 * Re-authentication
 *
 * Firebase refuses `user.delete()` with `auth/requires-recent-login` when the
 * sign-in credential is more than a few minutes old. Account deletion is
 * irreversible, so Firebase wants proof the person at the device is the account
 * holder — these re-present the original provider to get a fresh credential.
 * ------------------------------------------------------------------ */

/** Which provider this account signed in with, so the UI can ask correctly. */
export type NoirProvider = "apple" | "google" | "password" | "unknown";

export function currentProvider(): NoirProvider {
  const id = auth().currentUser?.providerData?.[0]?.providerId;
  if (id === "apple.com") return "apple";
  if (id === "google.com") return "google";
  if (id === "password") return "password";
  return "unknown";
}

function requireUser() {
  const user = auth().currentUser;
  if (!user) throw new Error("You are not signed in.");
  return user;
}

/**
 * Returns Apple's single-use authorization code. Account deletion needs it to
 * revoke the Sign in with Apple token, which Apple requires — deleting the
 * Firebase user alone leaves NOIR listed under the person's Apple ID.
 */
export async function reauthenticateWithApple(): Promise<string | null> {
  const user = requireUser();

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error("Apple Sign-In is not available on this device.");

  const response = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!response.identityToken) throw new Error("Apple did not return an identity token.");

  const credential = auth.AppleAuthProvider.credential(
    response.identityToken,
    response.authorizationCode || undefined,
  );
  await user.reauthenticateWithCredential(credential);
  return response.authorizationCode ?? null;
}

export async function reauthenticateWithGoogle() {
  const user = requireUser();
  configureGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error("Google sign-in was cancelled.");

  const credential = auth.GoogleAuthProvider.credential(idToken);
  await user.reauthenticateWithCredential(credential);
}

export async function reauthenticateWithPassword(password: string) {
  const user = requireUser();
  if (!user.email) throw new Error("This account has no email address on file.");

  const credential = auth.EmailAuthProvider.credential(user.email, password);
  await user.reauthenticateWithCredential(credential);
}

export type ReauthResult = {
  /** Present for Apple accounts; used to revoke the Sign in with Apple token. */
  appleAuthorizationCode: string | null;
};

/** Re-present whichever provider this account uses. */
export async function reauthenticate(password?: string): Promise<ReauthResult> {
  switch (currentProvider()) {
    case "apple":
      return { appleAuthorizationCode: await reauthenticateWithApple() };
    case "google":
      await reauthenticateWithGoogle();
      return { appleAuthorizationCode: null };
    case "password":
      if (!password) throw new Error("Enter your password to continue.");
      await reauthenticateWithPassword(password);
      return { appleAuthorizationCode: null };
    default:
      throw new Error("NOIR could not identify how this account signs in.");
  }
}
