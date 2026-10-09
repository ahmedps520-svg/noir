// Native Firebase is the single runtime Firebase implementation for NOIR.
// Keep the Web SDK config in firebase/config.ts for Firebase Console/web tooling,
// but use React Native Firebase for auth, Firestore, App Check and AI on iOS.
export { firebaseApp } from "../firebase/config";
