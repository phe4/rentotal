import type {
  RunAllOptions,
  ScheduledPriceCheckService,
  ScheduledPriceCheckSummary,
} from "../services/scheduledPriceCheckService.js";

export type PriceCheckCliOptions = RunAllOptions;

export type PriceCheckRunnerResult = {
  exitCode: number;
  output: string;
  error?: string;
};

export const defaultPriceCheckCliOptions: PriceCheckCliOptions = {
  cooldownMinutes: 360,
  dryRun: false,
  force: false,
};

type PriceCheckRunnerService = Pick<ScheduledPriceCheckService, "runAll">;

export function parsePriceCheckCliArgs(argv: string[]): PriceCheckCliOptions {
  const parsed: PriceCheckCliOptions = { ...defaultPriceCheckCliOptions };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (key === "--force") {
      parsed.force = true;
      continue;
    }
    if (key === "--cooldown-minutes") {
      parsed.cooldownMinutes = parsePositiveNumberArg(
        value,
        "--cooldown-minutes",
      );
      index += 1;
      continue;
    }
    if (key === "--max-sources") {
      parsed.maxSources = parsePositiveIntegerArg(value, "--max-sources");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${key}`);
  }
  return parsed;
}

export async function runPriceCheckCli(
  service: PriceCheckRunnerService,
  argv: string[],
): Promise<PriceCheckRunnerResult> {
  let options: PriceCheckCliOptions;
  try {
    options = parsePriceCheckCliArgs(argv);
  } catch (error) {
    return {
      exitCode: 1,
      output: "",
      error: error instanceof Error ? error.message : "Invalid arguments.",
    };
  }

  try {
    const summary = await service.runAll(options);
    return {
      exitCode: 0,
      output: formatPriceCheckSummary(summary),
    };
  } catch (error) {
    return {
      exitCode: 1,
      output: "",
      error:
        error instanceof Error ? error.message : "Price check runner failed.",
    };
  }
}

export function formatPriceCheckSummary(
  summary: ScheduledPriceCheckSummary,
): string {
  const lines = [
    "Price check run complete",
    `startedAt: ${summary.startedAt}`,
    `finishedAt: ${summary.finishedAt}`,
    `dryRun: ${summary.dryRun === true}`,
    `watchItemsScanned: ${summary.watchItemsScanned}`,
    `sourcesSelected: ${summary.sourcesSelected}`,
    `sourcesSkipped: ${summary.sourcesSkipped}`,
    `sourcesSucceeded: ${summary.sourcesSucceeded}`,
    `sourcesFailed: ${summary.sourcesFailed}`,
    `sourcesNeedsReview: ${summary.sourcesNeedsReview}`,
  ];

  if (summary.skipped.length > 0) {
    lines.push("skipped:");
    for (const skipped of summary.skipped) {
      const source = skipped.sourceId ? ` sourceId=${skipped.sourceId}` : "";
      lines.push(`- ${skipped.reason}${source}: ${skipped.message}`);
    }
  }

  return lines.join("\n");
}

function parsePositiveNumberArg(
  value: string | undefined,
  flag: string,
): number {
  if (value === undefined) throw new Error(`${flag} requires a value.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative number.`);
  }
  return parsed;
}

function parsePositiveIntegerArg(
  value: string | undefined,
  flag: string,
): number {
  if (value === undefined) throw new Error(`${flag} requires a value.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}
