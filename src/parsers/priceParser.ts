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
