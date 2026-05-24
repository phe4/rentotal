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

function findNumber(pattern: RegExp, text: string): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  return Number(match[1]);
}

function findSpecialOffer(text: string): string | undefined {
  const match = text.match(/\b(\d+)\s+(weeks?|months?)\s+free\b/i);
  return match?.[0];
}

export const genericHtmlRentParser: PriceParser = {
  name: "generic-html-rent-parser",
  parse(input): ParsedPriceItem[] {
    const text = decodeHtml(input.text);
    const rentMatch = text.match(
      /\b(?:rent:?\s*)?(?:starting\s+at\s*)?\$((?:[1-9]\d{0,2},\d{3})|(?:[1-9]\d{2,4}))(?:\s*\/?\s*(?:mo|month))?\b/i,
    );

    if (!rentMatch?.[1]) return [];

    const baseRent = parseInteger(rentMatch[1]);
    if (baseRent < 500 || baseRent > 20000) return [];

    const item: ParsedPriceItem = {
      baseRent,
      bedrooms:
        findNumber(/\b(\d+(?:\.\d+)?)\s*(?:beds?|br)\b/i, text) ?? undefined,
      bathrooms:
        findNumber(/\b(\d+(?:\.\d+)?)\s*(?:baths?|ba)\b/i, text) ?? undefined,
      sqft: findNumber(/\b(\d{3,5})\s*(?:sq\.?\s*ft|sqft)\b/i, text),
      specialOfferText: findSpecialOffer(text),
      rawData: {
        parser: genericHtmlRentParser.name,
        matchedRentText: rentMatch[0],
      },
    };

    return [item];
  },
};
