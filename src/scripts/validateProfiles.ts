import { findProfileById } from "../parsers/platformProfileRegistry.js";
import { platformProfileValidationCases } from "../parsers/platformProfileValidationCases.js";
import { validateProfileCase } from "../parsers/platformProfileValidation.js";

const reports = platformProfileValidationCases.map((profileCase) => {
  const profile = findProfileById(profileCase.profileId);
  if (!profile) {
    return {
      passed: false,
      profileId: profileCase.profileId,
      caseName: profileCase.name,
      itemCount: 0,
      expectedCount: profileCase.expectedItems.length,
      errors: [`Profile ${profileCase.profileId} was not found.`],
      warnings: [],
    };
  }
  return validateProfileCase({ profile, profileCase });
});

for (const report of reports) {
  const status = report.passed ? "PASS" : "FAIL";
  console.log(
    `${status} ${report.profileId} - ${report.caseName} (${report.itemCount}/${report.expectedCount} items)`,
  );
  for (const error of report.errors) {
    console.error(`  error: ${error}`);
  }
  for (const warning of report.warnings) {
    console.warn(`  warning: ${warning}`);
  }
}

if (reports.some((report) => !report.passed)) {
  process.exitCode = 1;
}
