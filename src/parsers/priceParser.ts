export type ParsedPriceItem = {
  floorplanName?: string;
  unitNumber?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  baseRent?: number;
  effectiveRent?: number;
  leaseTermMonths?: number;
  moveInDate?: string;
  specialOfferText?: string;
  specialOfferValue?: number;
  mandatoryFees?: number;
  availabilityStatus?: string;
  rawData?: unknown;
};

export interface PriceParser {
  name: string;
  parse(input: {
    url: string;
    text: string;
    contentType?: string;
  }): ParsedPriceItem[];
}

export type ParserContext = {
  url?: string;
  sourceUrl?: string;
  sourceType?: string;
  contentType?: string;
  metadata?: unknown;
};

export type ParserResult = {
  parserName: string;
  parserVersion: string;
  confidence: number;
  items: ParsedPriceItem[];
  metadata?: Record<string, unknown>;
};

export interface DomainPriceParser {
  name: string;
  version: string;
  priority: number;
  canParse(input: {
    url?: string;
    text?: string;
    json?: unknown;
    context?: ParserContext;
  }): boolean;
  parse(input: {
    url?: string;
    text?: string;
    json?: unknown;
    context?: ParserContext;
  }): ParserResult;
}
