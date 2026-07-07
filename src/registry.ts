export interface KnownSource {
  match: RegExp;
  source: string;
  note: string;
}

/**
 * Well-known vendorable datasets, matched by filename. Used by `freshlock init`
 * to suggest sources — never auto-added, since a filename match is only a guess.
 */
export const KNOWN_SOURCES: KnownSource[] = [
  {
    match: /public_suffix_list\.dat$/i,
    source: "https://publicsuffix.org/list/public_suffix_list.dat",
    note: "Mozilla Public Suffix List",
  },
  {
    match: /(^|[/\\_-])countr(y|ies)[^/\\]*\.json$/i,
    source: "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
    note: "mledoze/countries (ISO 3166 country data)",
  },
  {
    match: /(^|[/\\_-])currenc(y|ies)[^/\\]*\.json$/i,
    source: "https://raw.githubusercontent.com/datasets/currency-codes/main/data/codes-all.csv",
    note: "ISO 4217 currency codes (Frictionless Data)",
  },
  {
    match: /(^|[/\\_-])(iana-)?(tz|timezone|time_zones)[^/\\]*\.(json|csv)$/i,
    source: "https://raw.githubusercontent.com/vvo/tzdb/main/raw-time-zones.json",
    note: "vvo/tzdb (IANA time zone data)",
  },
  {
    match: /(^|[/\\_-])user[-_]?agents?[^/\\]*\.json$/i,
    source: "https://raw.githubusercontent.com/intoli/user-agents/main/src/user-agents.json.gz",
    note: "intoli/user-agents",
  },
  {
    match: /(^|[/\\_-])(satellites?|gp|omm|tle)[^/\\]*\.(json|csv)$/i,
    source: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json",
    note: "CelesTrak active satellites (GP data)",
  },
  {
    match: /(^|[/\\_-])languages?[^/\\]*\.json$/i,
    source: "https://raw.githubusercontent.com/datasets/language-codes/main/data/language-codes-full.csv",
    note: "ISO 639 language codes (Frictionless Data)",
  },
  {
    match: /(^|[/\\_-])mime[-_]?types?[^/\\]*\.json$/i,
    source: "https://raw.githubusercontent.com/jshttp/mime-db/master/db.json",
    note: "jshttp/mime-db",
  },
];

export function suggestSource(filePath: string): KnownSource | null {
  return KNOWN_SOURCES.find((k) => k.match.test(filePath)) ?? null;
}
