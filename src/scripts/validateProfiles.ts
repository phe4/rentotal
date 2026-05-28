import { findProfileById } from "../parsers/platformProfileRegistry.js";
import { platformProfileValidationCases } from "../parsers/platformProfileValidationCases.js";
import { validateProfileCase } from "../parsers/platformProfileValidation.js";

const args = parseArgs(process.argv.slice(2));

const reports = platformProfileValidationCases.map((profileCase) => {
  const profile = findProfileById(profileCase.profileId, {
    includeFileProfiles: true,
    profileRootDir: args.profileRoot,
  });
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

function parseArgs(argv: string[]): { profileRoot?: string } {
  const parsed: { profileRoot?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--profile-root" && value) {
      parsed.profileRoot = value;
      index += 1;
    }
  }
  return parsed;
}
