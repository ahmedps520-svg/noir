import * as Astronomy from "astronomy-engine";
import { planetaryPositions, SIGNS, type Placement, type PointName, type Sign } from "./chart";

/**
 * The live sky.
 *
 * Everything here is computed for the moment it is asked — positions, the
 * Moon, and upcoming events. The previous Sky tab hardcoded a meteor shower
 * that had already passed and admitted it didn't compute positions; nothing
 * on it is static any more, so it can't go stale.
 *
 * Positions are geocentric, so they don't depend on where the person is.
 */

const SYNODIC_MONTH = 29.530588853;
const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ *
 * Moon
 * ------------------------------------------------------------------ */

export type MoonPhase = {
  /** Days since the last new moon. */
  age: number;
  /** 0 = new, 0.5 = full, 1 = new again. */
  fraction: number;
  /** Percent of the disc lit, 0-100. */
  illumination: number;
  name: string;
  glyph: string;
  sign: Sign;
};

function describePhase(fraction: number): { name: string; glyph: string } {
  if (fraction < 0.02 || fraction >= 0.98) return { name: "New moon", glyph: "○" };
  if (fraction < 0.24) return { name: "Waxing crescent", glyph: "◑" };
  if (fraction < 0.26) return { name: "First quarter", glyph: "◑" };
  if (fraction < 0.49) return { name: "Waxing gibbous", glyph: "◕" };
  if (fraction < 0.51) return { name: "Full moon", glyph: "●" };
  if (fraction < 0.74) return { name: "Waning gibbous", glyph: "◔" };
  if (fraction < 0.76) return { name: "Last quarter", glyph: "◐" };
  return { name: "Waning crescent", glyph: "◐" };
}

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const elongation = Astronomy.MoonPhase(date); // 0 new, 180 full
  const fraction = elongation / 360;
  const illumination = Math.round(Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction * 100);
  // Only the Moon is needed here, and Home calls this on every render.
  const moonLon = Astronomy.EclipticGeoMoon(Astronomy.MakeTime(date)).lon;

  return {
    age: fraction * SYNODIC_MONTH,
    fraction,
    illumination,
    ...describePhase(fraction),
    sign: SIGNS[Math.floor((((moonLon % 360) + 360) % 360) / 30)],
  };
}

/* ------------------------------------------------------------------ *
 * Planets
 * ------------------------------------------------------------------ */

export const SKY_BODIES: PointName[] = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
];

const BODY: Partial<Record<PointName, Astronomy.Body>> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto,
};

export function currentSky(date: Date = new Date()): Placement[] {
  return planetaryPositions(date);
}

function positionOf(point: PointName, date: Date) {
  return planetaryPositions(date).find(p => p.point === point)!;
}

export type BodyDetail = {
  placement: Placement;
  /** Distance from Earth in astronomical units. */
  distanceAu: number;
  /** Apparent visual magnitude — lower is brighter. Null where meaningless. */
  magnitude: number | null;
  /** When it next changes sign, if within the search window. */
  nextIngress: { date: Date; sign: Sign } | null;
  /** When it next turns retrograde or direct, if within the window. */
  nextStation: { date: Date; becomes: "retrograde" | "direct" } | null;
};

/**
 * Step forward a day at a time until `changed` flips. Slow movers (Pluto spends
 * ~20 years in a sign) simply return null rather than searching forever.
 */
/**
 * First moment after `from` at which `changed` becomes true. Steps a day at a
 * time to find the right day, then bisects to within a few minutes — returning
 * the day-step itself put events up to a day late or early, depending on the
 * time of day the user happened to open the screen.
 */
function findChange(from: Date, maxDays: number, changed: (date: Date) => boolean) {
  for (let day = 1; day <= maxDays; day++) {
    const date = new Date(from.getTime() + day * DAY_MS);
    if (!changed(date)) continue;
    let lo = date.getTime() - DAY_MS;
    let hi = date.getTime();
    while (hi - lo > 5 * 60 * 1000) {
      const mid = (lo + hi) / 2;
      if (changed(new Date(mid))) hi = mid;
      else lo = mid;
    }
    return new Date(hi);
  }
  return null;
}

export function bodyDetail(point: PointName, date: Date = new Date()): BodyDetail {
  const body = BODY[point]!;
  const placement = positionOf(point, date);
  const distanceAu = Astronomy.GeoVector(body, date, true).Length();

  let magnitude: number | null = null;
  if (point !== "Sun") {
    try {
      magnitude = Astronomy.Illumination(body, date).mag;
    } catch {
      magnitude = null;
    }
  }

  // The Moon changes sign every ~2.5 days; outer planets can take years.
  const window = point === "Moon" ? 4 : 400;
  const ingressDate = findChange(date, window, d => positionOf(point, d).sign !== placement.sign);
  const nextIngress = ingressDate ? { date: ingressDate, sign: positionOf(point, ingressDate).sign } : null;

  let nextStation: BodyDetail["nextStation"] = null;
  if (point !== "Sun" && point !== "Moon") {
    const stationDate = findChange(date, 400, d => positionOf(point, d).retrograde !== placement.retrograde);
    if (stationDate) {
      nextStation = { date: stationDate, becomes: placement.retrograde ? "direct" : "retrograde" };
    }
  }

  return { placement, distanceAu, magnitude, nextIngress, nextStation };
}

/* ------------------------------------------------------------------ *
 * Upcoming events
 * ------------------------------------------------------------------ */

export type SkyEvent = {
  date: Date;
  title: string;
  detail: string;
  kind: "moon" | "eclipse" | "season" | "station" | "meteors";
};

/**
 * Annual meteor shower peaks (International Meteor Organization calendar).
 * These move by a day or so between years, which the copy says honestly.
 */
const METEOR_SHOWERS = [
  { name: "Quadrantids", month: 1, day: 3, rate: "up to 110 meteors an hour" },
  { name: "Lyrids", month: 4, day: 22, rate: "around 18 an hour" },
  { name: "Eta Aquariids", month: 5, day: 6, rate: "up to 50 an hour" },
  { name: "Perseids", month: 8, day: 12, rate: "up to 100 an hour" },
  { name: "Orionids", month: 10, day: 21, rate: "around 20 an hour" },
  { name: "Leonids", month: 11, day: 17, rate: "around 15 an hour" },
  { name: "Geminids", month: 12, day: 14, rate: "up to 150 an hour" },
];

function nextMeteorShower(from: Date): SkyEvent {
  const year = from.getFullYear();
  const candidates = [year, year + 1].flatMap(y =>
    METEOR_SHOWERS.map(s => ({ ...s, date: new Date(y, s.month - 1, s.day) })),
  );
  // Still worth showing on the peak day itself.
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const next = candidates.filter(c => c.date >= today).sort((a, b) => +a.date - +b.date)[0];
  return {
    date: next.date,
    title: `${next.name} meteor shower`,
    detail: `Peaks around this night, ${next.rate} under dark skies.`,
    kind: "meteors",
  };
}

const ECLIPSE_KIND: Record<string, string> = {
  penumbral: "Penumbral",
  partial: "Partial",
  total: "Total",
  annular: "Annular",
};

/** The next few real events, soonest first. */
export function upcomingEvents(from: Date = new Date(), limit = 6): SkyEvent[] {
  const events: SkyEvent[] = [];
  const time = Astronomy.MakeTime(from);

  const newMoon = Astronomy.SearchMoonPhase(0, time, 40);
  if (newMoon) {
    const sign = positionOf("Moon", newMoon.date).sign;
    events.push({ date: newMoon.date, title: `New moon in ${sign}`, detail: "The Moon is dark — a start-of-cycle night.", kind: "moon" });
  }

  const fullMoon = Astronomy.SearchMoonPhase(180, time, 40);
  if (fullMoon) {
    const sign = positionOf("Moon", fullMoon.date).sign;
    events.push({ date: fullMoon.date, title: `Full moon in ${sign}`, detail: "The Moon is fully lit and rises at sunset.", kind: "moon" });
  }

  // The Sun's next sign change — the start of the next zodiac season.
  const sunLon = positionOf("Sun", from).longitude;
  const nextBoundary = (Math.floor(sunLon / 30) + 1) * 30;
  const ingress = Astronomy.SearchSunLongitude(nextBoundary % 360, time, 40);
  if (ingress) {
    const sign = SIGNS[Math.floor((nextBoundary % 360) / 30)];
    events.push({ date: ingress.date, title: `Sun enters ${sign}`, detail: `${sign} season begins.`, kind: "season" });
  }

  const lunar = Astronomy.SearchLunarEclipse(from);
  events.push({
    date: lunar.peak.date,
    title: `${ECLIPSE_KIND[lunar.kind] ?? "Lunar"} lunar eclipse`,
    detail: "Visible from wherever the Moon is above the horizon.",
    kind: "eclipse",
  });

  const solar = Astronomy.SearchGlobalSolarEclipse(from);
  events.push({
    date: solar.peak.date,
    title: `${ECLIPSE_KIND[solar.kind] ?? "Solar"} solar eclipse`,
    detail: "Visible only along part of the globe — never look at it directly.",
    kind: "eclipse",
  });

  // Retrograde stations for the inner and visible planets, within ~4 months.
  for (const point of ["Mercury", "Venus", "Mars"] as PointName[]) {
    const now = positionOf(point, from);
    const station = findChange(from, 120, d => positionOf(point, d).retrograde !== now.retrograde);
    if (station) {
      const at = positionOf(point, station);
      events.push({
        date: station,
        title: `${point} turns ${now.retrograde ? "direct" : "retrograde"}`,
        detail: `At ${at.degree}° ${at.sign}.`,
        kind: "station",
      });
    }
  }

  events.push(nextMeteorShower(from));

  return events
    .filter(e => e.date.getTime() >= from.getTime() - DAY_MS)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function formatToday(date: Date = new Date()) {
  return date
    .toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase();
}

export function formatEventDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
