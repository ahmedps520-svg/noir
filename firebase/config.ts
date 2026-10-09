import { initializeApp } from "firebase/app";

// NOIR Firebase Web App configuration.
// This is the client configuration for the noir-60abb Firebase project.
export const firebaseConfig = {
  apiKey: "AIzaSyA_2kd9B03_3X1JcO9v4Jr8FppHB_u3cSY",
  authDomain: "noir-60abb.firebaseapp.com",
  projectId: "noir-60abb",
  storageBucket: "noir-60abb.firebasestorage.app",
  messagingSenderId: "293502846273",
  appId: "1:293502846273:web:7ef724b9604639b9034dc0",
};

export const firebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

export const firebaseApp = initializeApp(firebaseConfig);
