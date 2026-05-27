import type { DomainPriceParser, ParserResult } from "./priceParser.js";
import {
  normalizeEndpointForProfile,
  parseWithPlatformProfile,
  profileEndpointCanPromote,
  profileMatchesUrl,
  type PlatformProfile,
} from "./platformProfile.js";

export const cmsSiteManagerProfile: PlatformProfile = {
  id: "cmssitemanager-proxy-getunits",
  platform: "CmsSiteManager",
  version: "1.0.0",
  status: "APPROVED",
  match: {
    urlIncludes: ["/CmsSiteManager/callback.aspx"],
    query: {
      act: "Proxy/GetUnits",
    },
  },
  response: {
    format: "jsonp",
    arrayPath: "units",
  },
  mapping: {
    floorplanName: "floorplanName",
    unitNumber: ["unitNumber", "name"],
    bedrooms: "numberOfBeds",
    bathrooms: "numberOfBaths",
    sqft: "squareFeet",
    baseRent: "rent",
    leaseTermMonths: "minLeaseTermInMonth",
    moveInDate: "internalAvailableDate",
    mandatoryFees: "mandatoryFeesDeposits",
    availabilityStatus: ["unitLeasedStatus", "leaseStatus"],
  },
  rawData: {
    preserve: ["totalRent", "partnerName", "partnerPropertyId"],
  },
  rules: {
    requiredFields: ["baseRent"],
    numericFields: [
      "baseRent",
      "bedrooms",
      "bathrooms",
      "sqft",
      "mandatoryFees",
      "leaseTermMonths",
    ],
    minBaseRent: 300,
    maxBaseRent: 20_000,
    doNotUseAsBaseRent: ["totalRent"],
  },
  endpointPromotion: {
    canPromote: true,
    stripQueryParams: ["callback", "_"],
    requiredParseableItems: 1,
  },
};

export const entrataProfile: PlatformProfile = {
  id: "entrata-availability-floorplans",
  platform: "Entrata",
  version: "1.0.0",
  status: "DRAFT",
  match: {
    urlIncludes: ["entrata"],
    urlIncludesAny: ["availability", "floorplans", "floorplan"],
  },
  response: {
    format: "json",
    arrayPath: "data.items",
  },
  mapping: {
    floorplanName: ["floorplanName", "floorplan.name"],
    unitNumber: ["unitNumber", "apartmentName"],
    bedrooms: ["bedrooms", "beds"],
    bathrooms: ["bathrooms", "baths"],
    sqft: ["sqft", "squareFeet"],
    baseRent: ["baseRent", "marketRent", "minRent"],
    effectiveRent: "effectiveRent",
    leaseTermMonths: "leaseTermMonths",
    moveInDate: ["moveInDate", "availableDate"],
    specialOfferText: ["specialOfferText", "concessionText"],
    specialOfferValue: ["specialOfferValue", "concessionValue"],
    mandatoryFees: "mandatoryFees",
    availabilityStatus: ["availabilityStatus", "status"],
  },
  rawData: {
    preserve: ["maxRent", "floorplanId", "unitId", "availabilityStatus"],
  },
  rules: {
    requiredFields: ["baseRent"],
    numericFields: [
      "baseRent",
      "effectiveRent",
      "bedrooms",
      "bathrooms",
      "sqft",
      "leaseTermMonths",
      "specialOfferValue",
      "mandatoryFees",
    ],
    minBaseRent: 300,
    maxBaseRent: 20_000,
    doNotUseAsBaseRent: [
      "maxRent",
      "deposit",
      "applicationFee",
      "leaseTermMonths",
      "sqft",
      "squareFeet",
    ],
  },
  endpointPromotion: {
    canPromote: true,
    requiredParseableItems: 1,
  },
};

export const platformProfiles: PlatformProfile[] = [
  cmsSiteManagerProfile,
  entrataProfile,
];

export function findApprovedProfile(input: {
  url?: string;
}): PlatformProfile | undefined {
  return platformProfiles.find((profile) =>
    profileMatchesUrl(profile, input.url),
  );
}

export function findProfileById(
  profileId: string,
): PlatformProfile | undefined {
  return platformProfiles.find((profile) => profile.id === profileId);
}

export const platformProfileDomainParser: DomainPriceParser = {
  name: "platform-profile-parser",
  version: "1.0.0",
  priority: 50,
  canParse(input) {
    return (
      findApprovedProfile({ url: input.url ?? input.context?.url }) !==
      undefined
    );
  },
  parse(input): ParserResult {
    const profile = findApprovedProfile({
      url: input.url ?? input.context?.url,
    });
    if (!profile) {
      return {
        parserName: platformProfileDomainParser.name,
        parserVersion: platformProfileDomainParser.version,
        confidence: 0,
        items: [],
      };
    }
    const items = parseWithPlatformProfile({
      profile,
      url: input.url ?? input.context?.url,
      text: input.text,
      json: input.json,
    });
    return {
      parserName: platformProfileDomainParser.name,
      parserVersion: platformProfileDomainParser.version,
      confidence: items.length > 0 ? 0.86 : 0.25,
      items,
      metadata: {
        platform: profile.platform,
        profileVersion: profile.version,
      },
    };
  },
};

export { normalizeEndpointForProfile, profileEndpointCanPromote };
export type { PlatformProfile };
