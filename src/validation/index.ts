import { HttpError } from "./http.js";

export function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required.`);
  }
  return value.trim();
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
): string | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string")
    throw new HttpError(400, `${field} must be a string.`);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function optionalNumber(
  body: Record<string, unknown>,
  field: string,
): number | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpError(400, `${field} must be a number.`);
  }
  return value;
}

export function optionalDate(
  body: Record<string, unknown>,
  field: string,
): Date | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} must be a date string.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new HttpError(400, `${field} must be a valid date.`);
  return date;
}

export function enumValue<T extends readonly string[]>(
  body: Record<string, unknown>,
  field: string,
  allowed: T,
  fallback?: T[number],
): T[number] {
  const value = body[field];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

export function optionalEnum<T extends readonly string[]>(
  body: Record<string, unknown>,
  field: string,
  allowed: T,
): T[number] | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

export function optionalUrl(
  body: Record<string, unknown>,
  field: string,
): string | null | undefined {
  const value = optionalString(body, field);
  if (value === undefined || value === null) return value;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Unsupported protocol");
    return url.toString();
  } catch {
    throw new HttpError(400, `${field} must be a valid HTTP(S) URL.`);
  }
}

export function isUrlInputType(inputType: string): boolean {
  return inputType.endsWith("_URL") || inputType === "OFFICIAL_WEBSITE_URL";
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
