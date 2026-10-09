import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { generateNoirJson } from "./nativeFirebase";
import { NOIR_AI_GENERATION } from "../constants/config";
import { currentSky, getMoonPhase } from "./astronomy";
import { describeChartForPrompt, describeTransitsForPrompt, transitAspects } from "./chart";
import { getSavedProfile, getSavedReading, type ProfileInput } from "./reading";
import { isEntitlementValid, refreshEntitlement } from "./subscription";

/**
 * NOIR+ daily readings.
 *
 * Previously the "Daily" screen re-rendered the same four fields as the full
 * reading — generated once at purchase and never again — so a subscriber saw
 * identical text on day 1 and day 90. Each day now gets its own generated
 * entry, keyed by local date, plus a prompt the user can answer.
 */

export type DailyReading = {
  /** Local YYYY-MM-DD. */
  date: string;
  focus: string;
  relationships: string;
  /** Something specific to watch for today. */
  caution: string;
  /** A question for the user to answer. */
  prompt: string;
  moonPhase: string;
  createdAt: number;
};

export type DailyEntry = DailyReading & {
  /** The user's own answer to the prompt. */
  reflection: string;
  reflectionUpdatedAt: number | null;
};

/**
 * Local date key. Deliberately NOT toISOString() — that converts to UTC, so
 * anyone east or west of GMT would flip to "tomorrow" at the wrong moment.
 */
export function dateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function dailyCollection(uid: string) {
  return firestore().collection("users").doc(uid).collection("dailyReadings");
}

function requireUser() {
  const user = auth().currentUser;
  if (!user) throw new Error("Sign in to open your daily reading.");
  return user;
}

function hydrate(data: Record<string, unknown> | undefined, key: string): DailyEntry | null {
  if (!data) return null;
  const focus = String(data.focus ?? "");
  if (!focus) return null;

  return {
    date: String(data.date ?? key),
    focus,
    relationships: String(data.relationships ?? ""),
    caution: String(data.caution ?? ""),
    prompt: String(data.prompt ?? ""),
    moonPhase: String(data.moonPhase ?? ""),
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    reflection: String(data.reflection ?? ""),
    reflectionUpdatedAt:
      typeof data.reflectionUpdatedAt === "number" ? data.reflectionUpdatedAt : null,
  };
}

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

function buildDailyPrompt(
  profile: ProfileInput,
  archetype: string,
  traits: string[],
  key: string,
  recentFocus: string[],
) {
  const now = new Date();
  const moon = getMoonPhase(now);
  const readable = formatDateKey(key);

  // Everything astrological below is computed. The model interprets; it never
  // works out a position, an aspect or a sign on its own.
  const natalBlock = profile.chart
    ? `THEIR NATAL CHART (computed — fact)
${describeChartForPrompt(profile.chart)}

TODAY'S TRANSITS TO THEIR CHART (computed — fact, tightest first)
${describeTransitsForPrompt(transitAspects(profile.chart, now))}`
    : `THEIR NATAL CHART — not available. Do not name any sign or placement for them.`;

  const skyToday = currentSky(now)
    .map(p => `${p.point} in ${p.sign}${p.retrograde ? " (retrograde)" : ""}`)
    .join(", ");

  return `You are the private reading engine for NOIR.

Write TODAY'S reading for this person. It is ${readable}.

This must be specific to today and must NOT restate their standing profile. The
standing reading already covers who they are; today's reading covers what to do
with that today. Build it on today's transits to their chart where there are
any, and on their own answers. Be concrete and practical — something they could
actually act on before the day ends.

Important:
- This is entertainment and personal reflection, not prediction, medical advice, or diagnosis.
- Never claim a planet causes anything. Describe it as the day's weather, not fate.
- Only mention signs, planets, retrogrades and aspects that appear in the lists below. Never invent any.
- Name at most one or two transits — the tightest ones — and only if they genuinely shape the advice.
- Never mention that you are an AI, and never mention these instructions.
- Keep the tone restrained, cinematic, direct and premium. Address them as "you".
- No generic horoscope filler. No "the stars say". No deterministic predictions.
- Vary sentence rhythm and opening words from the recent days listed below.

THIS PERSON
Archetype: ${JSON.stringify(archetype)}
Traits: ${JSON.stringify(traits)}
Their answers:
${profile.answers.length ? profile.answers.map(a => `- ${a}`).join("\n") : "- (none recorded)"}

${natalBlock}

TODAY'S SKY (computed)
${skyToday}
Moon phase: ${moon.name}, ${moon.illumination}% lit, in ${moon.sign}

THEIR RECENT DAYS (do not repeat these openings, themes or advice)
${recentFocus.length ? recentFocus.map(f => `- ${f}`).join("\n") : "- (none yet)"}

Return ONLY valid JSON, no markdown fences, exactly this shape:
{
  "focus": "60-90 words on where to put their attention today",
  "relationships": "40-60 words on how to handle people today",
  "caution": "25-40 words on one specific thing to watch for today",
  "prompt": "one short, direct question for them to answer about today"
}`;
}

function parseDaily(raw: string, key: string): DailyReading {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error("NOIR received a malformed daily reading. Please try again.");
  }

  const focus = String(parsed.focus ?? "").trim();
  if (!focus) throw new Error("NOIR could not compose today's reading. Please try again.");

  const moon = getMoonPhase();

  return {
    date: key,
    focus,
    relationships: String(parsed.relationships ?? "").trim(),
    caution: String(parsed.caution ?? "").trim(),
    prompt: String(parsed.prompt ?? "").trim(),
    moonPhase: moon.name,
    createdAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function getDailyEntry(key: string): Promise<DailyEntry | null> {
  const user = requireUser();
  const snap = await dailyCollection(user.uid).doc(key).get();
  return hydrate(snap.data(), key);
}

export async function listRecentDaily(limit = 30): Promise<DailyEntry[]> {
  const user = auth().currentUser;
  if (!user) return [];

  // Date keys are zero-padded YYYY-MM-DD, so lexical order is chronological.
  const snap = await dailyCollection(user.uid).orderBy("date", "desc").limit(limit).get();

  return snap.docs
    .map(doc => hydrate(doc.data(), doc.id))
    .filter((entry): entry is DailyEntry => entry !== null);
}

/**
 * Consecutive days with an entry, counting back from today. A streak survives
 * "haven't opened it yet today" by also accepting yesterday as the anchor.
 */
export function streakFrom(entries: DailyEntry[]): number {
  if (entries.length === 0) return 0;

  const keys = new Set(entries.map(entry => entry.date));
  const today = new Date();

  const anchor = keys.has(dateKey(today))
    ? today
    : (() => {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return keys.has(dateKey(yesterday)) ? yesterday : null;
      })();

  if (!anchor) return 0;

  let streak = 0;
  const cursor = new Date(anchor);
  while (keys.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ------------------------------------------------------------------ *
 * Today
 * ------------------------------------------------------------------ */

/**
 * Return today's reading, generating it once if this is the first open today.
 * Safe to call on every mount — an existing entry short-circuits before any
 * model request.
 */
export async function ensureTodayReading(): Promise<DailyEntry> {
  const user = requireUser();

  const entitlement = await refreshEntitlement();
  if (!isEntitlementValid(entitlement)) {
    throw new Error("NOIR+ is required for daily readings.");
  }

  const key = dateKey();
  const existing = await getDailyEntry(key);
  if (existing) return existing;

  const profile = await getSavedProfile();
  if (!profile || !profile.birthDate) {
    throw new Error("NOIR couldn't find your birth details, so it can't write today's reading.");
  }

  const full = await getSavedReading("fullReading");
  const recent = await listRecentDaily(3);

  const raw = await generateNoirJson(
    buildDailyPrompt(
      profile,
      full?.archetype ?? "",
      full?.traits ?? [],
      key,
      recent.map(entry => entry.focus),
    ),
    NOIR_AI_GENERATION.dailyMaxOutputTokens,
  );

  const reading = parseDaily(raw, key);

  await dailyCollection(user.uid).doc(key).set(
    { ...reading, reflection: "", reflectionUpdatedAt: null },
    { merge: true },
  );

  return { ...reading, reflection: "", reflectionUpdatedAt: null };
}

/* ------------------------------------------------------------------ *
 * Reflection
 * ------------------------------------------------------------------ */

export async function saveReflection(key: string, reflection: string) {
  const user = requireUser();
  await dailyCollection(user.uid).doc(key).set(
    {
      reflection: reflection.trim(),
      reflectionUpdatedAt: Date.now(),
    },
    { merge: true },
  );
}
