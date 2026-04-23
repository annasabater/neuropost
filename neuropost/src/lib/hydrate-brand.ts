/**
 * Splits a concatenated location string ("Region, Country") into its two
 * parts. Used by the onboarding redo hydration and the brand edit page to
 * avoid duplicating the same parsing logic.
 *
 * Design contract:
 * - Returns raw DB values. Defaults for the UI (e.g. "España" when country is
 *   absent) are the callsite's responsibility — check for "" and apply your
 *   own default if needed.
 * - Splits on the FIRST comma only, so "A, B, C" → { region: "A", country: "B, C" }.
 * - Trailing comma ("Barcelona, ") returns country as "". The callsite should
 *   guard with `if (country) setCountry(country)` to preserve any form default.
 *
 * @example
 * parseLocation(null)               // { region: "", country: "" }
 * parseLocation("Cataluña, España") // { region: "Cataluña", country: "España" }
 * parseLocation("Barcelona")        // { region: "Barcelona", country: "" }
 * parseLocation("A, B, C")          // { region: "A", country: "B, C" }
 * parseLocation("Barcelona, ")      // { region: "Barcelona", country: "" }
 */
export function parseLocation(raw: string | null | undefined): {
  region: string;
  country: string;
} {
  if (!raw) return { region: '', country: '' };
  const idx = raw.indexOf(',');
  if (idx < 0) return { region: raw.trim(), country: '' };
  return {
    region:  raw.slice(0, idx).trim(),
    country: raw.slice(idx + 1).trim(),
  };
}
