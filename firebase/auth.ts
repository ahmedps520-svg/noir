import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

export type NoirUser = FirebaseAuthTypes.User;

export function createPermanentAccount(email: string, password: string) {
  return auth().createUserWithEmailAndPassword(email.trim(), password);
}

export function signIn(email: string, password: string) {
  return auth().signInWithEmailAndPassword(email.trim(), password);
}

export function onAuthStateChanged(
  listener: (user: NoirUser | null) => void,
) {
  return auth().onAuthStateChanged(listener);
}

export function signOut() {
  return auth().signOut();
}
