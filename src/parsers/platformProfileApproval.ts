import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PlatformProfile } from "./platformProfile.js";
import { loadPlatformProfileFile } from "./platformProfileFileLoader.js";
import {
  validateProfileCase,
  type ProfileValidationCase,
  type ProfileValidationReport,
} from "./platformProfileValidation.js";

export type ApprovePlatformProfileInput = {
  profileId: string;
  confirm: boolean;
  rootDir?: string;
  validationCases: ProfileValidationCase[];
};

export type ApprovePlatformProfileResult = {
  approvedProfile: PlatformProfile;
  approvedPath: string;
  draftPath: string;
  validationReports: ProfileValidationReport[];
};

export function approvePlatformProfile(
  input: ApprovePlatformProfileInput,
): ApprovePlatformProfileResult {
  if (!input.confirm) {
    throw new Error("Approval requires explicit --confirm.");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(input.profileId)) {
    throw new Error("profileId must be filename-safe.");
  }

  const root = path.resolve(input.rootDir ?? "platform-profiles");
  const draftRelativePath = path.join(
    "generated",
    `${input.profileId}.draft.json`,
  );
  const loaded = loadPlatformProfileFile({
    rootDir: root,
    relativePath: draftRelativePath,
    includeStatuses: ["DRAFT", "APPROVED", "DISABLED"],
  });
  if (loaded.errors.length > 0) {
    throw new Error(loaded.errors.map((error) => error.message).join("; "));
  }
  const draftProfile = loaded.profiles.find(
    (profile) => profile.id === input.profileId,
  );
  if (!draftProfile) {
    throw new Error(
      `Generated draft profile ${input.profileId} was not found.`,
    );
  }
  if (draftProfile.status === "APPROVED") {
    throw new Error("APPROVED profiles cannot be approved again.");
  }
  if (draftProfile.status === "DISABLED") {
    throw new Error("DISABLED profiles cannot be approved.");
  }
  if (draftProfile.status !== "DRAFT") {
    throw new Error("Only DRAFT profiles can be approved.");
  }

  const profileCases = input.validationCases.filter(
    (profileCase) => profileCase.profileId === input.profileId,
  );
  if (profileCases.length === 0) {
    throw new Error(`No validation case found for profile ${input.profileId}.`);
  }
  const validationReports = profileCases.map((profileCase) =>
    validateProfileCase({ profile: draftProfile, profileCase }),
  );
  const failures = validationReports.filter((report) => !report.passed);
  if (failures.length > 0) {
    throw new Error(
      `Profile validation failed: ${failures
        .flatMap((report) => report.errors)
        .join("; ")}`,
    );
  }

  const approvedProfile: PlatformProfile = {
    ...draftProfile,
    status: "APPROVED",
  };
  const approvedPath = safeApprovedPath(root, input.profileId);
  mkdirSync(path.dirname(approvedPath), { recursive: true });
  writeFileSync(approvedPath, `${JSON.stringify(approvedProfile, null, 2)}\n`);

  return {
    approvedProfile,
    approvedPath,
    draftPath: path.join(root, draftRelativePath),
    validationReports,
  };
}

function safeApprovedPath(root: string, profileId: string): string {
  const approvedRoot = path.resolve(root, "approved");
  const approvedPath = path.resolve(approvedRoot, `${profileId}.approved.json`);
  const relative = path.relative(approvedRoot, approvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      "Approved profile path must stay under platform-profiles/approved.",
    );
  }
  return approvedPath;
}
