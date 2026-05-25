import { parseGenericJsonRent } from "./genericJsonRentParser.js";
import { knockDoorwayParser } from "./knockDoorwayParser.js";
import type {
  DomainPriceParser,
  ParsedPriceItem,
  ParserContext,
  ParserResult,
} from "./priceParser.js";

export const genericJsonDomainParser: DomainPriceParser = {
  name: "generic-json-rent-parser",
  version: "1.0.0",
  priority: 10,
  canParse(input) {
    return input.json !== undefined;
  },
  parse(input): ParserResult {
    const items = parseGenericJsonRent(input.json);
    return {
      parserName: genericJsonDomainParser.name,
      parserVersion: genericJsonDomainParser.version,
      confidence: items.length > 0 ? 0.6 : 0,
      items,
    };
  },
};

export const priceParsers: DomainPriceParser[] = [
  knockDoorwayParser,
  genericJsonDomainParser,
].sort((a, b) => b.priority - a.priority);

export function parseJsonWithRegistry(input: {
  url?: string;
  json: unknown;
  context?: ParserContext;
}): ParserResult {
  const parser =
    priceParsers.find((candidate) => candidate.canParse(input)) ??
    genericJsonDomainParser;
  return parser.parse(input);
}

export function parseJsonPriceItems(input: {
  url?: string;
  json: unknown;
  context?: ParserContext;
}): ParsedPriceItem[] {
  return parseJsonWithRegistry(input).items;
}
