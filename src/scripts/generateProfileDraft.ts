import { generatePlatformProfileDraft } from "../parsers/platformProfileDraftGenerator.js";

const args = parseArgs(process.argv.slice(2));

if (!args.platform || !args.profileId || !args.samplePath) {
  console.error(
    'Usage: npm run profile:generate-draft -- --platform "Example" --profile-id "example-units" --sample test/fixtures/example/units.json [--url "https://example.com/api/units" (matching hint only, not fetched)] [--format json|jsonp]',
  );
  process.exitCode = 1;
} else {
  try {
    const result = generatePlatformProfileDraft({
      platform: args.platform,
      profileId: args.profileId,
      samplePath: args.samplePath,
      sampleUrl: args.sampleUrl,
      responseFormat: args.responseFormat,
    });
    console.log(`Generated DRAFT profile: ${result.outputPath}`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Draft generation failed.",
    );
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): {
  platform?: string;
  profileId?: string;
  samplePath?: string;
  sampleUrl?: string;
  responseFormat?: "json" | "jsonp";
} {
  const parsed: ReturnType<typeof parseArgs> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value) continue;
    if (key === "--platform") parsed.platform = value;
    if (key === "--profile-id") parsed.profileId = value;
    if (key === "--sample") parsed.samplePath = value;
    if (key === "--url") parsed.sampleUrl = value;
    if (key === "--format" && (value === "json" || value === "jsonp")) {
      parsed.responseFormat = value;
    }
    if (key.startsWith("--")) index += 1;
  }
  return parsed;
}
