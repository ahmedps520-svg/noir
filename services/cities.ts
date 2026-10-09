import { ADMIN1, CITY_ROWS, COUNTRIES, TIMEZONES } from "../data/cities";

/**
 * Offline birthplace search.
 *
 * Bundled rather than an API call on purpose: a birthplace typed here is never
 * sent to a third-party geocoder, so NOIR's "private to your account" stays
 * true, and search works with no connection. Data: GeoNames, CC BY 4.0 —
 * attribution is shown on the birth screen.
 */

export type City = {
  name: string;
  /** Region / state / province, when GeoNames has one. */
  region: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  /** IANA zone, e.g. "Europe/London" — needed to turn local birth time into UTC. */
  timezone: string;
};

type Row = City & { key: string; asciiKey: string };

let rows: Row[] | null = null;

function fold(text: string) {
  const lower = text.toLowerCase().trim();
  // Strip accents where the engine supports it, so "sao paulo" finds São Paulo.
  try {
    return lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch {
    return lower;
  }
}

/** Parsed on first use, not at import — keeps app start-up untouched. */
function load(): Row[] {
  if (rows) return rows;
  rows = CITY_ROWS.split("\n").map(line => {
    const [name, ascii, cc, a1, lat, lon, tz] = line.split("\t");
    return {
      name,
      region: ADMIN1[`${cc}.${a1}`] ?? null,
      country: COUNTRIES[cc] ?? cc,
      countryCode: cc,
      latitude: Number(lat),
      longitude: Number(lon),
      timezone: TIMEZONES[Number(tz)],
      key: fold(name),
      asciiKey: ascii ? fold(ascii) : "",
    };
  });
  return rows;
}

export function cityLabel(city: City) {
  return [city.name, city.region && city.region !== city.name ? city.region : null, city.country]
    .filter(Boolean)
    .join(", ");
}

/**
 * Prefix search, most populous first. "London" returns the UK capital ahead of
 * London, Ontario; "London, Canada" or "London Ontario" narrows to the latter.
 */
export function searchCities(query: string, limit = 6): City[] {
  const [placePart, ...qualifierParts] = query.split(",");
  const place = fold(placePart ?? "");
  if (place.length < 2) return [];

  const qualifier = fold(qualifierParts.join(" "));
  const results: City[] = [];

  for (const row of load()) {
    const nameHit = row.key.startsWith(place) || (row.asciiKey && row.asciiKey.startsWith(place));
    if (!nameHit) continue;

    if (qualifier) {
      const context = fold(`${row.region ?? ""} ${row.country} ${row.countryCode}`);
      if (!context.includes(qualifier)) continue;
    }

    results.push(row);
    if (results.length >= limit) break;
  }

  // "London Ontario" with no comma: if the full text found nothing, retry with
  // the last word treated as the qualifier.
  if (results.length === 0 && !qualifier && place.includes(" ")) {
    const cut = query.trim().lastIndexOf(" ");
    return searchCities(`${query.slice(0, cut)},${query.slice(cut + 1)}`, limit);
  }

  return results;
}
