import { Platform } from "react-native";
import { getApp } from "@react-native-firebase/app";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { getAI, getGenerativeModel, GoogleAIBackend } from "@react-native-firebase/ai";
import { initializeNoirAppCheck } from "../firebase/appCheck";
import { NOIR_AI_GENERATION, NOIR_AI_MODELS } from "../constants/config";

export const firebaseApp = getApp();
export const firebaseAuth = auth();
export const firestoreDb = firestore();

export function isNativeRuntime() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function assertNativeRuntime() {
  if (!isNativeRuntime()) {
    throw new Error(
      "NOIR AI requires the native iOS development build. Expo Go and web cannot load the native Firebase AI module.",
    );
  }
}

export type NoirModelOptions = {
  model?: string;
  maxOutputTokens?: number;
};

/**
 * Build a Gemini model handle through Firebase AI Logic.
 *
 * App Check is initialized first on purpose: Firebase AI Logic rejects requests
 * from clients that cannot present a valid App Check token. The instance must
 * also be handed to getAI — without it no App Check token is attached to
 * AI requests at all.
 */
export async function getNoirModel(options: NoirModelOptions = {}) {
  assertNativeRuntime();
  const appCheck = await initializeNoirAppCheck();

  const ai = getAI(firebaseApp, {
    backend: new GoogleAIBackend(),
    auth: firebaseAuth,
    appCheck,
  });

  return getGenerativeModel(ai, {
    model: options.model ?? NOIR_AI_MODELS[0],
    generationConfig: {
      temperature: NOIR_AI_GENERATION.temperature,
      maxOutputTokens: options.maxOutputTokens ?? NOIR_AI_GENERATION.fullMaxOutputTokens,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: NOIR_AI_GENERATION.thinkingLevel },
    },
  });
}

/**
 * A model id that this Firebase project does not have enabled fails at
 * generateContent() rather than at model construction, so availability can only
 * be discovered by asking. Distinguish "this model is unavailable" (try the
 * next one) from a real failure like App Check or network (surface it now).
 */
function isModelUnavailableError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error).toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("not_found") ||
    message.includes("404") ||
    message.includes("is not supported") ||
    message.includes("not supported for") ||
    message.includes("unsupported model") ||
    message.includes("does not exist") ||
    message.includes("not available") ||
    message.includes("no longer available") ||
    message.includes("has been shut down") ||
    message.includes("retired") ||
    message.includes("deprecated") ||
    message.includes("discontinued")
  );
}

/**
 * Ask Gemini for JSON, walking the configured model list on availability
 * errors. Returns the raw response text.
 */
export async function generateNoirJson(prompt: string, maxOutputTokens: number): Promise<string> {
  assertNativeRuntime();

  let lastError: unknown = null;

  for (const modelName of NOIR_AI_MODELS) {
    try {
      const model = await getNoirModel({ model: modelName, maxOutputTokens });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim()) return text;
      lastError = new Error(`NOIR received an empty response from ${modelName}.`);
    } catch (error) {
      lastError = error;
      if (!isModelUnavailableError(error)) throw error;
      if (__DEV__) {
        console.warn(`NOIR: model "${modelName}" unavailable, trying the next one.`, error);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("NOIR could not reach the reading engine.");
}
