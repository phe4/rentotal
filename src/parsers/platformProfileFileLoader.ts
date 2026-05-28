import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  FieldMapping,
  PlatformProfile,
  PlatformProfileStatus,
} from "./platformProfile.js";

export type PlatformProfileLoadError = {
  filePath: string;
  message: string;
};

export type PlatformProfileLoadResult = {
  profiles: PlatformProfile[];
  errors: PlatformProfileLoadError[];
};

export const DEFAULT_PLATFORM_PROFILES_ROOT = "platform-profiles";

const STATUSES: PlatformProfileStatus[] = ["DRAFT", "APPROVED", "DISABLED"];
const RESPONSE_FORMATS = ["json", "jsonp"];

export function loadApprovedFileProfiles(
  input: {
    rootDir?: string;
  } = {},
): PlatformProfileLoadResult {
  return loadProfilesFromDirectory({
    rootDir: input.rootDir,
    relativeDir: "approved",
    includeStatuses: ["APPROVED"],
  });
}

export function loadValidationFileProfiles(
  input: {
    rootDir?: string;
  } = {},
): PlatformProfileLoadResult {
  const approved = loadProfilesFromDirectory({
    rootDir: input.rootDir,
    relativeDir: "approved",
    includeStatuses: STATUSES,
  });
  const generated = loadProfilesFromDirectory({
    rootDir: input.rootDir,
    relativeDir: "generated",
    includeStatuses: STATUSES,
  });
  return {
    profiles: [...approved.profiles, ...generated.profiles],
    errors: [...approved.errors, ...generated.errors],
  };
}

export function loadPlatformProfileFile(input: {
  rootDir?: string;
  relativePath: string;
  includeStatuses?: PlatformProfileStatus[];
}): PlatformProfileLoadResult {
  const root = safeProfilesRoot(input.rootDir);
  const filePath = safeProfilePath(root, input.relativePath, {
    requireProfileBucket: true,
  });
  if (path.extname(filePath).toLowerCase() !== ".json") {
    return { profiles: [], errors: [] };
  }
  return readProfileFile({
    filePath,
    includeStatuses: input.includeStatuses ?? STATUSES,
  });
}

function loadProfilesFromDirectory(input: {
  rootDir?: string;
  relativeDir: "approved" | "generated";
  includeStatuses: PlatformProfileStatus[];
}): PlatformProfileLoadResult {
  const root = safeProfilesRoot(input.rootDir);
  const directory = safeProfilePath(root, input.relativeDir);
  if (!existsSync(directory)) return { profiles: [], errors: [] };

  const results = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => path.extname(entry.name).toLowerCase() === ".json")
    .map((entry) =>
      readProfileFile({
        filePath: path.join(directory, entry.name),
        includeStatuses: input.includeStatuses,
      }),
    );

  return {
    profiles: results.flatMap((result) => result.profiles),
    errors: results.flatMap((result) => result.errors),
  };
}

function readProfileFile(input: {
  filePath: string;
  includeStatuses: PlatformProfileStatus[];
}): PlatformProfileLoadResult {
  try {
    const parsed = JSON.parse(readFileSync(input.filePath, "utf8")) as unknown;
    const result = validatePlatformProfile(parsed, input.filePath);
    if (!result.profile) {
      return {
        profiles: [],
        errors: [
          { filePath: input.filePath, message: result.errors.join("; ") },
        ],
      };
    }
    if (!input.includeStatuses.includes(result.profile.status)) {
      return { profiles: [], errors: [] };
    }
    return { profiles: [result.profile], errors: [] };
  } catch (error) {
    return {
      profiles: [],
      errors: [
        {
          filePath: input.filePath,
          message:
            error instanceof Error ? error.message : "Invalid profile file.",
        },
      ],
    };
  }
}

export function validatePlatformProfile(
  value: unknown,
  source = "profile",
): { profile?: PlatformProfile; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { errors: [`${source} must be a JSON object.`] };
  }

  requireString(value, "id", errors);
  requireString(value, "platform", errors);
  requireString(value, "version", errors);
  if (!STATUSES.includes(value.status as PlatformProfileStatus)) {
    errors.push("status must be one of DRAFT, APPROVED, DISABLED.");
  }

  validateMatch(value.match, errors);
  validateResponse(value.response, errors);
  validateMapping(value.mapping, errors);
  validateRawData(value.rawData, errors);
  validateRules(value.rules, errors);
  validateEndpointPromotion(value.endpointPromotion, errors);

  if (errors.length > 0) return { errors };
  return { profile: value as PlatformProfile, errors: [] };
}

function safeProfilesRoot(rootDir = DEFAULT_PLATFORM_PROFILES_ROOT): string {
  if (/^(?:https?|file):\/\//i.test(rootDir)) {
    throw new Error("Profile root must be a local directory.");
  }
  return path.resolve(rootDir);
}

function safeProfilePath(
  root: string,
  relativePath: string,
  input: { requireProfileBucket?: boolean } = {},
): string {
  if (/^(?:https?|file):\/\//i.test(relativePath)) {
    throw new Error("Profile paths must be local.");
  }
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      "Profile path traversal outside platform-profiles is not allowed.",
    );
  }
  if (input.requireProfileBucket) {
    const [bucket] = relative.split(path.sep);
    if (bucket !== "approved" && bucket !== "generated") {
      throw new Error("Profile files must be under approved or generated.");
    }
  }
  return resolved;
}

function validateMatch(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("match must be an object.");
    return;
  }
  optionalStringArray(value.urlIncludes, "match.urlIncludes", errors);
  optionalStringArray(value.urlIncludesAny, "match.urlIncludesAny", errors);
  if (value.query !== undefined) {
    if (!isRecord(value.query)) {
      errors.push("match.query must be an object.");
    } else {
      for (const [key, item] of Object.entries(value.query)) {
        if (typeof item !== "string") {
          errors.push(`match.query.${key} must be a string.`);
        }
      }
    }
  }
}

function validateResponse(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("response must be an object.");
    return;
  }
  if (!RESPONSE_FORMATS.includes(String(value.format))) {
    errors.push("response.format must be json or jsonp.");
  }
  requireString(value, "arrayPath", errors, "response.arrayPath");
}

function validateMapping(value: unknown, errors: string[]): void {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    errors.push("mapping must be a non-empty object.");
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (!isFieldMapping(item)) {
      errors.push(`mapping.${key} must be a string or string array.`);
    }
  }
}

function validateRawData(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push("rawData must be an object.");
    return;
  }
  optionalStringArray(value.preserve, "rawData.preserve", errors);
}

function validateRules(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("rules must be an object.");
    return;
  }
  if (
    !Array.isArray(value.requiredFields) ||
    value.requiredFields.length === 0
  ) {
    errors.push("rules.requiredFields must be a non-empty string array.");
  } else {
    optionalStringArray(value.requiredFields, "rules.requiredFields", errors);
  }
  optionalStringArray(value.numericFields, "rules.numericFields", errors);
  optionalStringArray(
    value.doNotUseAsBaseRent,
    "rules.doNotUseAsBaseRent",
    errors,
  );
  optionalNumber(value.minBaseRent, "rules.minBaseRent", errors);
  optionalNumber(value.maxBaseRent, "rules.maxBaseRent", errors);
  if (
    typeof value.minBaseRent === "number" &&
    typeof value.maxBaseRent === "number" &&
    value.maxBaseRent < value.minBaseRent
  ) {
    errors.push(
      "rules.maxBaseRent must be greater than or equal to rules.minBaseRent.",
    );
  }
}

function validateEndpointPromotion(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push("endpointPromotion must be an object.");
    return;
  }
  if (typeof value.canPromote !== "boolean") {
    errors.push("endpointPromotion.canPromote must be a boolean.");
  }
  optionalStringArray(
    value.stripQueryParams,
    "endpointPromotion.stripQueryParams",
    errors,
  );
  optionalNumber(
    value.requiredParseableItems,
    "endpointPromotion.requiredParseableItems",
    errors,
  );
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
  label = key,
): void {
  if (typeof value[key] !== "string" || value[key].trim() === "") {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function optionalStringArray(
  value: unknown,
  label: string,
  errors: string[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} must be a string array.`);
  }
}

function optionalNumber(value: unknown, label: string, errors: string[]): void {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
  }
}

function isFieldMapping(value: unknown): value is FieldMapping {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
