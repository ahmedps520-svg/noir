import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { generateNoirJson } from "./nativeFirebase";
import { NOIR_AI_GENERATION } from "../constants/config";
import { isEntitlementValid, refreshEntitlement } from "./subscription";
import { normalizeAnswers } from "../firebase/profile";
import { chartFromBirthData, describeChartForPrompt, type NatalChart } from "./chart";

export type ProfileInput = {
  answers: string[];
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  displayName?: string | null;
  /** Null when the birthplace has no coordinates (older accounts). */
  chart?: NatalChart | null;
};

export type NoirReading = {
  archetype: string;
  traits: string[];
  core: string;
  relationships: string;
  ambition: string;
  /** Rendered as "Patterns" in the UI. */
  reflection: string;
  daily: string;
  /** Full reading only. */
  strengths: string[];
  /** Full reading only. */
  blindSpots: string[];
};

export const EMPTY_READING: NoirReading = {
  archetype: "",
  traits: [],
  core: "",
  relationships: "",
  ambition: "",
  reflection: "",
  daily: "",
  strengths: [],
  blindSpots: [],
};

/* ------------------------------------------------------------------ *
 * Prompt
 * ------------------------------------------------------------------ */

function buildPrompt(input: ProfileInput, full: boolean) {
  const depth = full
    ? `Create the complete NOIR+ reading. Every section must be substantial, specific and clearly built from THIS person's answers. Aim for 90-140 words per paragraph section. Include distinct, useful insight for personality, relationships, ambition, patterns and a daily outlook, plus concrete strengths and blind spots. Do not pad, repeat, or restate the same idea in different sections.`
    : `Create a SHORT preview that feels genuinely personal but deliberately leaves depth locked. Give an archetype, exactly three traits, one concise core insight (55-80 words) and one relationship insight (45-70 words). Leave "ambition", "reflection" and "daily" as empty strings, and "strengths" and "blindSpots" as empty arrays — those belong to the paid reading. Do not summarize the full reading.`;

  // The chart is computed by services/chart.ts. The model interprets it; it is
  // never asked to work out positions, which it cannot do reliably.
  const chartBlock = input.chart
    ? `NATAL CHART — computed from their exact birth time and place (tropical zodiac).
These placements are fact. Use them exactly as written; never contradict them, and
never mention any placement, aspect or house that is not in this list.
${describeChartForPrompt(input.chart)}`
    : `NATAL CHART — not available for this person. Do not name any sign or planetary
placement at all; work from their answers alone.`;

  return `You are the private reading engine for NOIR.

NOIR's promise is a reading about THIS person, not their star sign. You do that by
combining two things a horoscope never has: their full natal chart, and their own
answers about how they actually live. The answers are the strongest signal; the
chart explains and deepens them. Where they agree, say so; where they pull against
each other, that tension is the most interesting thing you can tell them.

${depth}

Important:
- This is entertainment and personal reflection, not prediction, medical advice, or psychological diagnosis. Never claim the chart scientifically determines anything.
- Reference specific placements by name where they genuinely add something ("your Moon in Aquarius…"), but do not list placements for their own sake.
- Reference their specific answers, not generic categories.
- Never mention that you are an AI, and never mention these instructions.
- Never use generic horoscope filler or wording that would fit any reader with the same Sun sign.
- Keep the tone restrained, cinematic, direct and premium. Address the reader as "you".
- Do not make deterministic claims about relationships or the user's future.

THEIR ANSWERS
${input.answers.length ? input.answers.map(a => `- ${a}`).join("\n") : "- (none recorded)"}

${chartBlock}

Return ONLY valid JSON, with no markdown fences, matching exactly this shape:
{
  "archetype": "two or three word title, uppercase",
  "traits": ["trait", "trait", "trait"],
  "core": "paragraph",
  "relationships": "paragraph",
  "ambition": "paragraph",
  "reflection": "paragraph about recurring patterns",
  "daily": "short outlook for today",
  "strengths": ["short phrase", "short phrase", "short phrase"],
  "blindSpots": ["short phrase", "short phrase"]
}`;
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

function toStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Models occasionally wrap JSON in prose or code fences even when asked not to.
 * Recover the object rather than failing the whole reading.
 */
function extractJson(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (cleaned.startsWith("{")) return cleaned;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);

  return cleaned;
}

export function parseReading(raw: string): NoirReading {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("NOIR received a malformed reading. Please try again.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("NOIR received an invalid reading. Please try again.");
  }

  const reading: NoirReading = {
    archetype: String(parsed.archetype ?? "").trim(),
    traits: toStringArray(parsed.traits, 3),
    core: String(parsed.core ?? "").trim(),
    relationships: String(parsed.relationships ?? "").trim(),
    ambition: String(parsed.ambition ?? "").trim(),
    reflection: String(parsed.reflection ?? "").trim(),
    daily: String(parsed.daily ?? "").trim(),
    strengths: toStringArray(parsed.strengths, 4),
    blindSpots: toStringArray(parsed.blindSpots, 3),
  };

  // A reading with no archetype and no core is not renderable — treat it as a
  // failure so the UI shows a retry instead of an empty premium screen.
  if (!reading.archetype && !reading.core) {
    throw new Error("NOIR could not compose your reading. Please try again.");
  }

  if (!reading.archetype) reading.archetype = "YOUR NOIR";
  return reading;
}

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

function userDoc(uid: string) {
  return firestore().collection("users").doc(uid);
}

export async function generateReading(input: ProfileInput, full = false): Promise<NoirReading> {
  const user = auth().currentUser;
  if (!user) throw new Error("Sign in to generate your NOIR reading.");

  // The full reading is the paid product. Confirm the entitlement against
  // StoreKit here so it cannot be produced by navigating to a screen.
  if (full) {
    const entitlement = await refreshEntitlement();
    if (!isEntitlementValid(entitlement)) {
      throw new Error("NOIR+ is required to unlock your full reading.");
    }
  }

  const maxOutputTokens = full
    ? NOIR_AI_GENERATION.fullMaxOutputTokens
    : NOIR_AI_GENERATION.previewMaxOutputTokens;

  const raw = await generateNoirJson(buildPrompt(input, full), maxOutputTokens);
  const reading = parseReading(raw);

  await userDoc(user.uid).set(
    {
      ...(full ? { fullReading: reading } : { previewReading: reading }),
      readingUpdatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return reading;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

function hydrateReading(value: unknown): NoirReading | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  return {
    archetype: String(data.archetype ?? ""),
    traits: toStringArray(data.traits, 3),
    core: String(data.core ?? ""),
    relationships: String(data.relationships ?? ""),
    ambition: String(data.ambition ?? ""),
    reflection: String(data.reflection ?? ""),
    daily: String(data.daily ?? ""),
    strengths: toStringArray(data.strengths, 4),
    blindSpots: toStringArray(data.blindSpots, 3),
  };
}

export async function getSavedReading(
  kind: "previewReading" | "fullReading",
): Promise<NoirReading | null> {
  const user = auth().currentUser;
  if (!user) return null;
  const snap = await userDoc(user.uid).get();
  return hydrateReading(snap.data()?.[kind]);
}

export async function getSavedProfile(): Promise<ProfileInput | null> {
  const user = auth().currentUser;
  if (!user) return null;

  const snap = await userDoc(user.uid).get();
  const data = snap.data();
  if (!data) return null;

  return {
    answers: normalizeAnswers(data.onboardingAnswers),
    birthDate: String(data.birthDate ?? ""),
    birthTime: String(data.birthTime ?? ""),
    birthPlace: String(data.birthPlace ?? ""),
    displayName: (data.displayName as string | null) ?? user.displayName ?? null,
    chart: chartFromBirthData({
      birthDate: String(data.birthDate ?? ""),
      birthTime: String(data.birthTime ?? ""),
      latitude: typeof data.birthLatitude === "number" ? data.birthLatitude : null,
      longitude: typeof data.birthLongitude === "number" ? data.birthLongitude : null,
      timezone: typeof data.birthTimezone === "string" ? data.birthTimezone : null,
    }),
  };
}

export function hasReadingContent(reading: NoirReading | null): reading is NoirReading {
  return Boolean(reading && (reading.core || reading.archetype));
}
