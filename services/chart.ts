import * as Astronomy from "astronomy-engine";

/**
 * NOIR's natal chart engine.
 *
 * Positions are computed, never guessed. The AI receives these placements as
 * fixed facts and is told to interpret them — previously it was given the raw
 * birthplace text and birth time and could only gesture at astrology.
 *
 * Conventions (each verified against known values):
 *   - Tropical zodiac, geocentric, apparent positions on the ecliptic of date.
 *   - Ascendant / Midheaven from local apparent sidereal time and the true
 *     obliquity of the ecliptic.
 *   - No house system. Houses are contested between traditions; signs and the
 *     angles are not, so NOIR commits only to what it can stand behind.
 */

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export type Sign = (typeof SIGNS)[number];

export const SIGN_GLYPH: Record<Sign, string> = {
  Aries: "♈︎",
  Taurus: "♉︎",
  Gemini: "♊︎",
  Cancer: "♋︎",
  Leo: "♌︎",
  Virgo: "♍︎",
  Libra: "♎︎",
  Scorpio: "♏︎",
  Sagittarius: "♐︎",
  Capricorn: "♑︎",
  Aquarius: "♒︎",
  Pisces: "♓︎",
};

export type PointName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto"
  | "Ascendant"
  | "Midheaven";

export type Placement = {
  point: PointName;
  /** Ecliptic longitude, 0–360. */
  longitude: number;
  sign: Sign;
  /** Whole degrees within the sign, 0–29. */
  degree: number;
  minute: number;
  retrograde: boolean;
};

export type NatalChart = {
  /** The instant of birth, ISO-8601 UTC. */
  utc: string;
  latitude: number;
  longitude: number;
  timezone: string;
  placements: Placement[];
};

const PLANETS: { point: PointName; body: Astronomy.Body }[] = [
  { point: "Sun", body: Astronomy.Body.Sun },
  { point: "Moon", body: Astronomy.Body.Moon },
  { point: "Mercury", body: Astronomy.Body.Mercury },
  { point: "Venus", body: Astronomy.Body.Venus },
  { point: "Mars", body: Astronomy.Body.Mars },
  { point: "Jupiter", body: Astronomy.Body.Jupiter },
  { point: "Saturn", body: Astronomy.Body.Saturn },
  { point: "Uranus", body: Astronomy.Body.Uranus },
  { point: "Neptune", body: Astronomy.Body.Neptune },
  { point: "Pluto", body: Astronomy.Body.Pluto },
];

const DEG = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

/**
 * Offset of `timeZone` from UTC, in minutes, at a given UTC instant —
 * including historical DST, which matters for anyone born before a rule change.
 */
function zoneOffsetMinutes(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // some engines render midnight as "24"
    get("minute"),
    get("second"),
  );
  return (wallAsUtc - utcMs) / 60_000;
}

/**
 * Convert a wall-clock birth time at the birthplace into a UTC instant.
 *
 * The person enters local time, so the zone must be applied for that specific
 * date. Two passes settle the DST boundary case where the first guess lands on
 * the other side of a transition.
 */
export function birthInstantUtc(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  const first = zoneOffsetMinutes(wall, timeZone);
  let utc = wall - first * 60_000;
  const second = zoneOffsetMinutes(utc, timeZone);
  if (second !== first) utc = wall - second * 60_000;
  return new Date(utc);
}

/* ------------------------------------------------------------------ *
 * Positions
 * ------------------------------------------------------------------ */

function placement(point: PointName, longitude: number, retrograde = false): Placement {
  const lon = norm360(longitude);
  const signIndex = Math.floor(lon / 30);
  const within = lon - signIndex * 30;
  // Truncate, never round: chart convention, and rounding 29°59′45″ up would
  // both print an impossible "30°" and move the point into the wrong sign.
  const degree = Math.floor(within);
  const minute = Math.floor((within - degree) * 60);
  return { point, longitude: lon, sign: SIGNS[signIndex], degree, minute, retrograde };
}

function eclipticLongitude(body: Astronomy.Body, time: Astronomy.AstroTime) {
  if (body === Astronomy.Body.Moon) return Astronomy.EclipticGeoMoon(time).lon;
  // Apparent geocentric direction, rotated onto the true ecliptic of date.
  return Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true)).elon;
}

/** Positions of the Sun, Moon and planets at an instant — no location needed. */
export function planetaryPositions(at: Date): Placement[] {
  const time = Astronomy.MakeTime(at);
  // Motion is measured across one hour centred on the instant. A one-day
  // forward step flagged planets retrograde up to a day before they stationed.
  const before = time.AddDays(-1 / 48);
  const after = time.AddDays(1 / 48);

  return PLANETS.map(({ point, body }) => {
    const now = eclipticLongitude(body, time);
    // Apparent backward motion against the zodiac. Never true of Sun or Moon.
    let delta = eclipticLongitude(body, after) - eclipticLongitude(body, before);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const retrograde = point !== "Sun" && point !== "Moon" && delta < 0;
    return placement(point, now, retrograde);
  });
}

/** The two chart angles. These are what birth time and birthplace buy. */
export function chartAngles(at: Date, latitude: number, longitude: number) {
  const time = Astronomy.MakeTime(at);
  const ramc = norm360(Astronomy.SiderealTime(time) * 15 + longitude) * DEG;
  const obliquity = Astronomy.e_tilt(time).tobl * DEG;
  const phi = latitude * DEG;

  const midheaven = Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(obliquity)) / DEG;
  const ascendant =
    Math.atan2(
      Math.cos(ramc),
      -(Math.sin(ramc) * Math.cos(obliquity) + Math.tan(phi) * Math.sin(obliquity)),
    ) / DEG;

  return {
    ascendant: placement("Ascendant", ascendant),
    midheaven: placement("Midheaven", midheaven),
  };
}

export function computeNatalChart(input: {
  date: { year: number; month: number; day: number };
  time: { hour: number; minute: number };
  latitude: number;
  longitude: number;
  timezone: string;
}): NatalChart {
  const utc = birthInstantUtc(input.date, input.time, input.timezone);
  const { ascendant, midheaven } = chartAngles(utc, input.latitude, input.longitude);

  return {
    utc: utc.toISOString(),
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone,
    placements: [...planetaryPositions(utc), ascendant, midheaven],
  };
}

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

export function findPlacement(chart: NatalChart | null | undefined, point: PointName) {
  return chart?.placements.find(p => p.point === point) ?? null;
}

export function formatPlacement(p: Placement) {
  const minutes = String(p.minute).padStart(2, "0");
  return `${p.point} ${p.degree}°${minutes}′ ${p.sign}${p.retrograde ? " (retrograde)" : ""}`;
}

/** One line per placement, in the exact form handed to the model. */
export function describeChartForPrompt(chart: NatalChart) {
  return chart.placements.map(formatPlacement).join("\n");
}

/**
 * Build the chart from NOIR's stored birth fields ("DD/MM/YYYY", "HH:MM",
 * coordinates, IANA zone). Returns null rather than throwing when anything is
 * missing — accounts created before birthplace search have no coordinates, and
 * their readings must still work, just without placements.
 */
export function chartFromBirthData(input: {
  birthDate: string;
  birthTime: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}): NatalChart | null {
  const { birthDate, birthTime, latitude, longitude, timezone } = input;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !timezone) return null;

  const [day, month, year] = birthDate.split("/").map(Number);
  const [hour, minute] = birthTime.split(":").map(Number);
  if (![day, month, year, hour, minute].every(Number.isFinite)) return null;

  try {
    return computeNatalChart({
      date: { year, month, day },
      time: { hour, minute },
      latitude,
      longitude,
      timezone,
    });
  } catch (error) {
    if (__DEV__) console.warn("NOIR: chart could not be computed.", error);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Transits
 * ------------------------------------------------------------------ */

const ASPECTS = [
  { name: "conjunct", angle: 0 },
  { name: "sextile", angle: 60 },
  { name: "square", angle: 90 },
  { name: "trine", angle: 120 },
  { name: "opposite", angle: 180 },
] as const;

/** Tight orb: only aspects that are genuinely active today. */
const TRANSIT_ORB = 3;

export type TransitAspect = {
  transiting: PointName;
  aspect: (typeof ASPECTS)[number]["name"];
  natal: PointName;
  orb: number;
};

/**
 * Today's planets against the person's personal points. These are the facts a
 * daily reading is built on — computed, so the model never has to guess them.
 */
export function transitAspects(natal: NatalChart, at: Date = new Date()): TransitAspect[] {
  const personal = natal.placements.filter(p =>
    ["Sun", "Moon", "Ascendant", "Midheaven", "Venus", "Mars"].includes(p.point),
  );
  const found: TransitAspect[] = [];

  for (const t of planetaryPositions(at)) {
    for (const n of personal) {
      let separation = Math.abs(t.longitude - n.longitude) % 360;
      if (separation > 180) separation = 360 - separation;
      for (const a of ASPECTS) {
        const orb = Math.abs(separation - a.angle);
        if (orb <= TRANSIT_ORB) {
          found.push({ transiting: t.point, aspect: a.name, natal: n.point, orb });
        }
      }
    }
  }

  // Tightest first: those are the strongest today.
  return found.sort((a, b) => a.orb - b.orb);
}

export function describeTransitsForPrompt(aspects: TransitAspect[]) {
  if (aspects.length === 0) return "(no major transits to their personal points today)";
  return aspects
    .slice(0, 6)
    .map(a => `Transiting ${a.transiting} ${a.aspect} natal ${a.natal} (orb ${a.orb.toFixed(1)}°)`)
    .join("\n");
}
