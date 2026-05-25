import type { ParsedPriceItem, PriceParser } from "./priceParser.js";

function decodeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseInteger(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function hasFeeLikeContext(text: string, index: number): boolean {
  const context = text.slice(Math.max(0, index - 60), index + 120);
  return /\b(?:fee|fees|deposit|deposits|application|admin|security|pet|parking|holding)\b/i.test(
    context,
  );
}

function findRentMatch(
  text: string,
): { baseRent: number; matchedRentText: string; maxRent?: number } | undefined {
  const rangeMatch = text.match(
    /\$((?:[1-9]\d{0,2},\d{3})|(?:[1-9]\d{2,4}))\s*[-\u2013]\s*\$?((?:[1-9]\d{0,2},\d{3})|(?:[1-9]\d{2,4}))/i,
  );
  if (
    rangeMatch?.[1] &&
    rangeMatch[2] &&
    !hasFeeLikeContext(text, rangeMatch.index ?? 0)
  ) {
    const baseRent = parseInteger(rangeMatch[1]);
    const maxRent = parseInteger(rangeMatch[2]);
    if (baseRent >= 500 && baseRent <= 20_000 && maxRent >= baseRent) {
      return { baseRent, maxRent, matchedRentText: rangeMatch[0] };
    }
  }

  const rentMatch = text.match(
    /\b(?:rent:?\s*)?(?:(?:starting\s+at|from)\s*)?\$((?:[1-9]\d{0,2},\d{3})|(?:[1-9]\d{2,4}))(?:\s*\/?\s*(?:mo|month))?\b/i,
  );
  if (!rentMatch?.[1]) return undefined;
  if (hasFeeLikeContext(text, rentMatch.index ?? 0)) return undefined;
  return {
    baseRent: parseInteger(rentMatch[1]),
    matchedRentText: rentMatch[0],
  };
}

function findNumber(pattern: RegExp, text: string): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  return Number(match[1]);
}

function findSpecialOffer(text: string): string | undefined {
  const match = text.match(/\b(\d+)\s+(weeks?|months?)\s+free\b/i);
  return match?.[0];
}

function findAvailability(text: string): string | undefined {
  if (/\bunavailable\b|\bnot\s+available\b/i.test(text)) return "UNAVAILABLE";
  if (/\bavailable\b|\bnow\s+leasing\b/i.test(text)) return "AVAILABLE";
  return undefined;
}

export const genericHtmlRentParser: PriceParser = {
  name: "generic-html-rent-parser",
  parse(input): ParsedPriceItem[] {
    const text = decodeHtml(input.text);
    const rent = findRentMatch(text);
    if (!rent) return [];

    const baseRent = rent.baseRent;
    if (baseRent < 500 || baseRent > 20000) return [];

    const item: ParsedPriceItem = {
      baseRent,
      bedrooms:
        findNumber(/\b(\d+(?:\.\d+)?)\s*(?:beds?|br)\b/i, text) ?? undefined,
      bathrooms:
        findNumber(/\b(\d+(?:\.\d+)?)\s*(?:baths?|ba)\b/i, text) ?? undefined,
      sqft: findNumber(/\b(\d{3,5})\s*(?:sq\.?\s*ft|sqft)\b/i, text),
      specialOfferText: findSpecialOffer(text),
      availabilityStatus: findAvailability(text),
      rawData: {
        parser: genericHtmlRentParser.name,
        matchedRentText: rent.matchedRentText,
        ...(rent.maxRent === undefined ? {} : { maxRent: rent.maxRent }),
      },
    };

    return [item];
  },
};
