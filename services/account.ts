import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

export async function createEmailAccount(email: string, password: string) {
  return auth().createUserWithEmailAndPassword(email.trim(), password);
}

export async function signInEmail(email: string, password: string) {
  return auth().signInWithEmailAndPassword(email.trim(), password);
}

export async function saveNoirProfile(data: Record<string, any>) {
  const user = auth().currentUser;
  if (!user) throw new Error("NOIR account is not ready.");
  await firestore().collection("users").doc(user.uid).set({
    ...data,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getNoirProfile() {
  const user = auth().currentUser;
  if (!user) return null;
  const snap = await firestore().collection("users").doc(user.uid).get();
  return snap.exists() ? snap.data() : null;
}
