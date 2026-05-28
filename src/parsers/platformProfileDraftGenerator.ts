import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseJsonOrJsonp } from "./jsonpUtils.js";
import type { FieldMapping, PlatformProfile } from "./platformProfile.js";

export type GeneratePlatformProfileDraftInput = {
  platform: string;
  profileId: string;
  samplePath: string;
  sampleUrl?: string;
  responseFormat?: "json" | "jsonp";
  outputRootDir?: string;
};

export type GeneratePlatformProfileDraftResult = {
  profile: PlatformProfile;
  outputPath: string;
};

type ArrayCandidate = {
  path: string;
  rows: Record<string, unknown>[];
  score: number;
};

const ALLOWED_SAMPLE_ROOTS = ["test/fixtures", "platform-profiles/samples"];
const GENERATED_DIR = "generated";
const RENT_KEYS = ["rent", "price", "marketRent", "minRent", "minimumRent"];
const UNSAFE_BASE_RENT_KEYS = [
  "totalRent",
  "id",
  "propertyId",
  "siteId",
  "phone",
  "sqft",
  "squareFeet",
  "leaseTerm",
  "leaseTermMonths",
  "deposit",
  "fee",
  "applicationFee",
  "parkingFee",
  "trackingId",
];
const NUMERIC_FIELDS = [
  "baseRent",
  "bedrooms",
  "bathrooms",
  "sqft",
  "mandatoryFees",
  "specialOfferValue",
  "leaseTermMonths",
] as const;
const PRESERVE_KEYS = [
  "totalRent",
  "maxRent",
  "minRent",
  "partnerName",
  "partnerPropertyId",
  "floorplanId",
  "unitId",
];
const SENSITIVE_KEY_PATTERN =
  /token|auth|cookie|session|password|secret|resident|user/i;

export function generatePlatformProfileDraft(
  input: GeneratePlatformProfileDraftInput,
): GeneratePlatformProfileDraftResult {
  const sampleText = readSafeSample(input.samplePath);
  const responseFormat =
    input.responseFormat ?? inferResponseFormat(input.samplePath);
  const parsed = parseSample(sampleText, responseFormat);
  const candidate = bestArrayCandidate(parsed);
  if (!candidate) {
    throw new Error("No confident arrayPath candidate found in sample.");
  }

  const mapping = suggestMapping(candidate.rows);
  if (!mapping.baseRent) {
    throw new Error("No safe baseRent mapping candidate found in sample.");
  }

  const profile: PlatformProfile = {
    id: input.profileId,
    platform: input.platform,
    version: "0.1.0",
    status: "DRAFT",
    match: matchFromSampleUrl(input.sampleUrl),
    response: {
      format: responseFormat,
      arrayPath: candidate.path,
    },
    mapping,
    rawData: {
      preserve: suggestRawDataPreserve(candidate.rows),
    },
    rules: {
      requiredFields: ["baseRent"],
      numericFields: NUMERIC_FIELDS.filter(
        (field) => mapping[field] !== undefined,
      ),
      minBaseRent: 300,
      maxBaseRent: 20_000,
      doNotUseAsBaseRent: UNSAFE_BASE_RENT_KEYS,
    },
    endpointPromotion: {
      canPromote: canSuggestEndpointPromotion(
        input.sampleUrl,
        candidate,
        mapping,
      ),
      requiredParseableItems: 1,
    },
  };

  const outputPath = generatedProfilePath(input.outputRootDir, input.profileId);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(profile, null, 2)}\n`);
  return { profile, outputPath };
}

export function detectArrayPathCandidates(sample: unknown): ArrayCandidate[] {
  const candidates: ArrayCandidate[] = [];
  walk(sample, "", candidates);
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreRows(candidate.rows) }))
    .filter((candidate) => candidate.score >= 4)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export function suggestMapping(
  rows: Record<string, unknown>[],
): Partial<PlatformProfile["mapping"]> {
  const keys = allRowKeys(rows);
  const mapping: Partial<PlatformProfile["mapping"]> = {};
  setMapping(mapping, "floorplanName", keys, [
    "floorplanName",
    "floorPlanName",
    "floorplan",
    "floorPlan",
  ]);
  setMapping(mapping, "unitNumber", keys, [
    "unitNumber",
    "unit",
    "unitName",
    "apartmentName",
  ]);
  setMapping(mapping, "bedrooms", keys, ["bedrooms", "beds", "bed"]);
  setMapping(mapping, "bathrooms", keys, ["bathrooms", "baths", "bath"]);
  setMapping(mapping, "sqft", keys, ["sqft", "squareFeet"]);
  setMapping(mapping, "baseRent", keys, RENT_KEYS);
  setMapping(mapping, "leaseTermMonths", keys, [
    "leaseTermMonths",
    "leaseTerm",
    "minLeaseTermInMonth",
  ]);
  setMapping(mapping, "moveInDate", keys, [
    "moveInDate",
    "availableDate",
    "availabilityDate",
  ]);
  setMapping(mapping, "mandatoryFees", keys, [
    "mandatoryFees",
    "mandatoryFeesDeposits",
  ]);
  setMapping(mapping, "availabilityStatus", keys, [
    "availabilityStatus",
    "available",
    "availability",
    "status",
  ]);
  setMapping(mapping, "specialOfferText", keys, [
    "specialOfferText",
    "special",
    "concessionText",
  ]);
  setMapping(mapping, "specialOfferValue", keys, [
    "specialOfferValue",
    "concessionValue",
  ]);

  if (mapping.baseRent && unsafeBaseRentMapping(mapping.baseRent)) {
    delete mapping.baseRent;
  }
  return mapping;
}

function readSafeSample(samplePath: string): string {
  if (/^(?:https?|file):\/\//i.test(samplePath)) {
    throw new Error("Sample path must be a local file.");
  }
  const resolved = path.resolve(samplePath);
  const allowed = ALLOWED_SAMPLE_ROOTS.some((root) => {
    const allowedRoot = path.resolve(root);
    const relative = path.relative(allowedRoot, resolved);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  });
  if (!allowed) {
    throw new Error(
      "Sample path must be under an allowed fixture/sample directory.",
    );
  }
  return readFileSync(resolved, "utf8");
}

function parseSample(text: string, responseFormat: "json" | "jsonp"): unknown {
  const parsed =
    responseFormat === "json" ? JSON.parse(text) : parseJsonOrJsonp(text);
  if (parsed === null || parsed === undefined) {
    throw new Error("Sample could not be parsed as JSON or JSONP.");
  }
  return parsed;
}

function inferResponseFormat(samplePath: string): "json" | "jsonp" {
  return samplePath.toLowerCase().endsWith(".jsonp") ? "jsonp" : "json";
}

function bestArrayCandidate(sample: unknown): ArrayCandidate | undefined {
  return detectArrayPathCandidates(sample)[0];
}

function walk(
  value: unknown,
  currentPath: string,
  candidates: ArrayCandidate[],
): void {
  if (Array.isArray(value)) {
    const rows = value.filter(isRecord);
    if (rows.length > 0 && currentPath) {
      candidates.push({ path: currentPath, rows, score: 0 });
    }
    value.forEach((item, index) =>
      walk(
        item,
        currentPath ? `${currentPath}.${index}` : String(index),
        candidates,
      ),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    walk(item, currentPath ? `${currentPath}.${key}` : key, candidates);
  }
}

function scoreRows(rows: Record<string, unknown>[]): number {
  const keys = allRowKeys(rows).map(normalizeKey);
  let score = 0;
  for (const signal of [
    "rent",
    "price",
    "marketrent",
    "minrent",
    "unit",
    "unitnumber",
    "floorplan",
    "floorplanname",
    "beds",
    "bedrooms",
    "baths",
    "bathrooms",
    "sqft",
    "squarefeet",
    "available",
    "availability",
    "moveindate",
    "special",
    "concession",
  ]) {
    if (keys.some((key) => key.includes(signal))) score += 1;
  }
  if (keys.some((key) => RENT_KEYS.map(normalizeKey).includes(key))) score += 4;
  return score;
}

function setMapping(
  mapping: Partial<PlatformProfile["mapping"]>,
  target: keyof PlatformProfile["mapping"],
  keys: string[],
  candidates: string[],
): void {
  const found = candidates.find((candidate) =>
    keys.some((key) => normalizeKey(key) === normalizeKey(candidate)),
  );
  if (found) mapping[target] = found as FieldMapping;
}

function allRowKeys(rows: Record<string, unknown>[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
}

function suggestRawDataPreserve(rows: Record<string, unknown>[]): string[] {
  const keys = allRowKeys(rows);
  return PRESERVE_KEYS.filter(
    (key) =>
      keys.some((rowKey) => normalizeKey(rowKey) === normalizeKey(key)) &&
      !SENSITIVE_KEY_PATTERN.test(key),
  );
}

function matchFromSampleUrl(
  sampleUrl: string | undefined,
): PlatformProfile["match"] {
  if (!sampleUrl) return {};
  try {
    const parsed = new URL(sampleUrl);
    const pathSignals = parsed.pathname
      .split("/")
      .filter(Boolean)
      .filter((part) =>
        /unit|availability|available|floorplan|pricing/i.test(part),
      );
    return {
      urlIncludes: [parsed.hostname],
      ...(pathSignals.length > 0 ? { urlIncludesAny: pathSignals } : {}),
    };
  } catch {
    return {};
  }
}

function canSuggestEndpointPromotion(
  sampleUrl: string | undefined,
  candidate: ArrayCandidate,
  mapping: Partial<PlatformProfile["mapping"]>,
): boolean {
  return Boolean(
    sampleUrl &&
    /unit|availability|available|floorplan|pricing/i.test(sampleUrl) &&
    candidate.score >= 6 &&
    mapping.baseRent,
  );
}

function generatedProfilePath(
  rootDir: string | undefined,
  profileId: string,
): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(profileId)) {
    throw new Error("profileId must be filename-safe.");
  }
  const root = path.resolve(rootDir ?? "platform-profiles");
  const generated = path.resolve(root, GENERATED_DIR);
  const output = path.resolve(generated, `${profileId}.draft.json`);
  const relative = path.relative(generated, output);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      "Generated profile path must stay under platform-profiles/generated.",
    );
  }
  return output;
}

function unsafeBaseRentMapping(mapping: FieldMapping): boolean {
  const paths = Array.isArray(mapping) ? mapping : [mapping];
  return paths.some((item) =>
    UNSAFE_BASE_RENT_KEYS.map(normalizeKey).includes(normalizeKey(item)),
  );
}

function normalizeKey(key: string): string {
  return key.replace(/[_\-\s.]/g, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
