// Native AI is the production path used by NOIR on iOS/Android.
// This file is kept as a small compatibility wrapper for any older screen imports.
import { Platform } from "react-native";
import { getNoirModel } from "../services/nativeFirebase";

export async function generateNoirReading(prompt: string) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("NOIR AI requires the native iOS development build.");
  }

  const model = await getNoirModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}
