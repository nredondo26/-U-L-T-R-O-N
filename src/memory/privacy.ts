// src/memory/privacy.ts
// Privacy filter — blocks PII, health data, protected attributes from memory
// Based on Claude's privacy requirements

const BLOCKED_PATTERNS = [
  // PII
  /\b\d{3}-\d{2}-\d{4}\b/,                          // SSN
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,        // Credit card
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{10,}\b/,                                     // Phone (10+ digits)

  // Address
  /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|apt|apartment|suite)/i,

  // Health
  /\b(diabetes|cancer|HIV|AIDS|hepatitis|tuberculosis|alzheimer|covid|coronavirus)\b/i,
  /\b(diagnosed with|suffering from|treated for)\s+\w+/i,
  /\b(therap|psychiatr|medication|prescription|dosage|dose)\w*/i,

  // Protected attributes
  /\b(white|black|hispanic|latino|asian|african|european|indian|middle eastern|native american)\b.*\b(man|woman|person|descent|heritage|background|origin)\b/i,
  /\b(catholic|christian|muslim|jewish|hindu|buddhist|atheist|agnostic|mormon|protestant)\b/i,
  /\b(gay|lesbian|bisexual|transgender|straight|heterosexual|homosexual|queer)\b/i,
  /\b(immigrant|immigration|citizenship|green card|visa status|undocumented|naturalization)\b/i,
];

export function filterPrivateInfo(text: string): string {
  let filtered = text;
  for (const pattern of BLOCKED_PATTERNS) {
    filtered = filtered.replace(pattern, '[privado]');
  }
  return filtered;
}

export function isSafeForMemory(text: string): boolean {
  const blockedCount = BLOCKED_PATTERNS.reduce((count, pattern) => {
    const matches = text.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
  // Allow if less than 20% of text is flagged
  const words = text.split(/\s+/).length || 1;
  return blockedCount / words < 0.2;
}
