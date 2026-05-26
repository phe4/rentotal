import { readFileSync } from "node:fs";
import path from "node:path";
import type { ParsedPriceItem } from "./priceParser.js";
import {
  parseWithPlatformProfile,
  type PlatformProfile,
} from "./platformProfile.js";

export type ProfileValidationCase = {
  name: string;
  profileId: string;
  input: {
    url: string;
    contentType?: string;
    fixturePath: string;
  };
  expectedItems: Array<Partial<ParsedPriceItem>>;
};

export type ProfileValidationReport = {
  passed: boolean;
  profileId: string;
  caseName: string;
  itemCount: number;
  expectedCount: number;
  errors: string[];
  warnings: string[];
};

export function validateProfileCase(input: {
  profile: PlatformProfile;
  profileCase: ProfileValidationCase;
  readFixture?: (fixturePath: string) => string;
}): ProfileValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { profile, profileCase } = input;

  if (profile.id !== profileCase.profileId) {
    errors.push(
      `Validation case profileId ${profileCase.profileId} does not match profile ${profile.id}.`,
    );
  }

  const fixtureText =
    input.readFixture?.(profileCase.input.fixturePath) ??
    readLocalFixture(profileCase.input.fixturePath);
  const items = parseWithPlatformProfile({
    profile,
    url: profileCase.input.url,
    text: fixtureText,
    explicitValidationMode: true,
  });

  compareItems(items, profileCase.expectedItems, errors);

  return {
    passed: errors.length === 0,
    profileId: profileCase.profileId,
    caseName: profileCase.name,
    itemCount: items.length,
    expectedCount: profileCase.expectedItems.length,
    errors,
    warnings,
  };
}

function readLocalFixture(fixturePath: string): string {
  if (/^(?:https?|file):\/\//i.test(fixturePath)) {
    throw new Error("Profile validation fixtures must be local files.");
  }
  const fixturesRoot = path.resolve("test", "fixtures");
  const resolvedPath = path.resolve(fixturePath);
  const relativePath = path.relative(fixturesRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Profile validation fixtures must be under test/fixtures.");
  }
  return readFileSync(resolvedPath, "utf8");
}

function compareItems(
  actualItems: ParsedPriceItem[],
  expectedItems: Array<Partial<ParsedPriceItem>>,
  errors: string[],
): void {
  if (actualItems.length !== expectedItems.length) {
    errors.push(
      `Expected ${expectedItems.length} parsed item(s) but received ${actualItems.length}.`,
    );
  }

  const itemCount = Math.min(actualItems.length, expectedItems.length);
  for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
    const actual = actualItems[itemIndex];
    const expected = expectedItems[itemIndex];
    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = actual[field as keyof ParsedPriceItem];
      if (!valuesMatch(actualValue, expectedValue)) {
        errors.push(
          `Item ${itemIndex} field ${field} expected ${formatValue(expectedValue)} but received ${formatValue(actualValue)}.`,
        );
      }
    }
  }
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.trim() === expected.trim();
  }
  return Object.is(actual, expected);
}

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}
