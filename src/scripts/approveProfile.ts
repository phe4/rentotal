import { approvePlatformProfile } from "../parsers/platformProfileApproval.js";
import { platformProfileValidationCases } from "../parsers/platformProfileValidationCases.js";

const args = parseArgs(process.argv.slice(2));

if (!args.profileId) {
  console.error(
    "Usage: npm run profile:approve -- --profile-id example-units --confirm",
  );
  process.exitCode = 1;
} else {
  try {
    const result = approvePlatformProfile({
      profileId: args.profileId,
      confirm: args.confirm,
      validationCases: platformProfileValidationCases,
    });
    console.log(`Approved profile written: ${result.approvedPath}`);
    console.log(`Original draft preserved: ${result.draftPath}`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Profile approval failed.",
    );
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): { profileId?: string; confirm: boolean } {
  const parsed: { profileId?: string; confirm: boolean } = { confirm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--confirm") {
      parsed.confirm = true;
      continue;
    }
    if (key === "--profile-id" && value) {
      parsed.profileId = value;
      index += 1;
    }
  }
  return parsed;
}
