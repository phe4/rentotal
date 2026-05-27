import type { ProfileValidationCase } from "./platformProfileValidation.js";

export const cmsSiteManagerValidationCases: ProfileValidationCase[] = [
  {
    name: "CmsSiteManager Proxy/GetUnits basic units",
    profileId: "cmssitemanager-proxy-getunits",
    input: {
      url: "https://example.com/CmsSiteManager/callback.aspx?act=Proxy/GetUnits&siteid=1206682",
      contentType: "application/javascript",
      fixturePath: "test/fixtures/cmssitemanager/units.jsonp",
    },
    expectedItems: [
      {
        floorplanName: "A1",
        unitNumber: "153",
        bedrooms: 1,
        bathrooms: 1,
        sqft: 710,
        baseRent: 2719,
        mandatoryFees: 85,
        leaseTermMonths: 13,
        availabilityStatus: "AVAILABLE",
      },
    ],
  },
];

export const entrataValidationCases: ProfileValidationCase[] = [
  {
    name: "Entrata unit-level availability",
    profileId: "entrata-availability-floorplans",
    input: {
      url: "https://example.test/entrata/availability",
      contentType: "application/json",
      fixturePath: "test/fixtures/entrata/availability.json",
    },
    expectedItems: [
      {
        floorplanName: "A2",
        unitNumber: "204",
        bedrooms: 1,
        bathrooms: 1,
        sqft: 735,
        baseRent: 2645,
        effectiveRent: 2595,
        leaseTermMonths: 12,
        moveInDate: "2026-06-15",
        specialOfferText: "2 weeks free",
        specialOfferValue: 1220,
        mandatoryFees: 65,
        availabilityStatus: "AVAILABLE",
      },
    ],
  },
  {
    name: "Entrata floorplan-level rent range",
    profileId: "entrata-availability-floorplans",
    input: {
      url: "https://example.test/entrata/floorplans",
      contentType: "application/json",
      fixturePath: "test/fixtures/entrata/floorplans.json",
    },
    expectedItems: [
      {
        floorplanName: "A1",
        bedrooms: 1,
        bathrooms: 1,
        sqft: 710,
        baseRent: 2519,
        availabilityStatus: "AVAILABLE",
      },
    ],
  },
  {
    name: "Entrata no-rent availability",
    profileId: "entrata-availability-floorplans",
    input: {
      url: "https://example.test/entrata/availability",
      contentType: "application/json",
      fixturePath: "test/fixtures/entrata/no-rent.json",
    },
    expectedItems: [],
  },
];

export const platformProfileValidationCases: ProfileValidationCase[] = [
  ...cmsSiteManagerValidationCases,
  ...entrataValidationCases,
];
