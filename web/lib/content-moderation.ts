const MAX_BLOCKED_KEYWORDS = 50;
const MAX_KEYWORD_LENGTH = 80;

/** Normalize and validate a blocklist from API / UI input. */
export function normalizeBlockedKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    const keyword = String(item ?? '')
      .trim()
      .toLowerCase()
      .slice(0, MAX_KEYWORD_LENGTH);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    out.push(keyword);
    if (out.length >= MAX_BLOCKED_KEYWORDS) break;
  }

  return out;
}

/** True when content contains any blocked keyword (case-insensitive substring). */
export function contentMatchesBlockedKeyword(
  content: string,
  blockedKeywords: string[] | undefined | null
): string | null {
  if (!blockedKeywords?.length) return null;
  const haystack = content.toLowerCase();
  for (const keyword of blockedKeywords) {
    const needle = keyword.trim().toLowerCase();
    if (needle && haystack.includes(needle)) return keyword;
  }
  return null;
}

export const BLOCKED_KEYWORD_LIMITS = {
  maxKeywords: MAX_BLOCKED_KEYWORDS,
  maxKeywordLength: MAX_KEYWORD_LENGTH,
} as const;
