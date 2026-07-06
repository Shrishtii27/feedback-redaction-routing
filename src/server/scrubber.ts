export interface ScrubResult {
  cleanText: string;
  redactedCount: number;
  categories: string[];
}

// Regex patterns for sensitive PII
export const PII_PATTERNS = {
  EMAIL: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  
  // Matches 13-16 digit sequences with optional dashes or spaces, e.g., 4111-2222-3333-4444 or 4111 2222 3333 4444
  CREDIT_CARD: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b|\b(?:\d[ -]*?){13,16}\b/g,
  
  // Matches typical US and international phone formats: e.g. +1 (123) 456-7890, 123-456-7890, 1234567890
  PHONE_NUMBER: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  
  // Matches typical US SSN or 10-character Health Claim ID patterns (e.g. 123-45-6789 or alpha-numeric IDs)
  HEALTH_ID_SSN: /\b\d{3}-\d{2}-\d{4}\b|\b[A-Z]{2}\d{5}[A-Z]{3}\b|\b[A-Z0-9]{10}\b/g,
};

/**
 * Deterministically scrubs PII from text using high-fidelity regex patterns.
 * Ensures composite cases (multiple types of PII) are fully scrubbed to [REDACTED].
 */
export function regexScrub(text: string): ScrubResult {
  let cleanText = text;
  let redactedCount = 0;
  const categories: string[] = [];

  // Helper to apply regex and record statistics
  const applyRegex = (regex: RegExp, categoryName: string) => {
    const matches = cleanText.match(regex);
    if (matches && matches.length > 0) {
      redactedCount += matches.length;
      categories.push(categoryName);
      cleanText = cleanText.replace(regex, '[REDACTED]');
    }
  };

  // Run all scrubbers sequentially to handle composite cases
  applyRegex(PII_PATTERNS.EMAIL, 'Email');
  applyRegex(PII_PATTERNS.CREDIT_CARD, 'Credit Card');
  applyRegex(PII_PATTERNS.PHONE_NUMBER, 'Phone Number');
  applyRegex(PII_PATTERNS.HEALTH_ID_SSN, 'Health ID / SSN');

  return {
    cleanText,
    redactedCount,
    categories,
  };
}

/**
 * Generates an obscured audit summary of the original text.
 * Replaces middle parts of PII with asterisks so operators can see context/structure
 * without exposing sensitive compliance-violating data.
 */
export function maskOriginalText(text: string): string {
  let masked = text;

  // Mask emails: john.doe@gmail.com -> j***e@g***.com
  masked = masked.replace(PII_PATTERNS.EMAIL, (match) => {
    const [name, domain] = match.split('@');
    if (!name || !domain) return '[EMAIL]';
    const maskedName = name[0] + '***' + name[name.length - 1];
    const maskedDomain = domain[0] + '***' + domain.substring(domain.lastIndexOf('.'));
    return `${maskedName}@${maskedDomain}`;
  });

  // Mask credit cards: 4111-2222-3333-4444 -> ****-****-****-4444
  masked = masked.replace(PII_PATTERNS.CREDIT_CARD, (match) => {
    const cleanCC = match.replace(/[- ]/g, '');
    const last4 = cleanCC.slice(-4);
    return `****-****-****-${last4}`;
  });

  // Mask phone numbers: (123) 456-7890 -> (***) ***-7890
  masked = masked.replace(PII_PATTERNS.PHONE_NUMBER, (match) => {
    const digits = match.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `(***) ***-${last4}`;
  });

  // Mask SSN/Health IDs: 123-45-6789 -> ***-**-6789
  masked = masked.replace(PII_PATTERNS.HEALTH_ID_SSN, (match) => {
    if (match.includes('-')) {
      const parts = match.split('-');
      return `***-**-${parts[2] || '****'}`;
    }
    return match.substring(0, 2) + '******' + match.slice(-2);
  });

  return masked;
}
