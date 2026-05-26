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

export const platformProfileValidationCases: ProfileValidationCase[] = [
  ...cmsSiteManagerValidationCases,
];
