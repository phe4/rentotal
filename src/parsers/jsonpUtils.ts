export function unwrapJsonp(input: string): unknown | null {
  const text = input.trim();
  const match = text.match(
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(([\s\S]*)\)\s*;?\s*$/,
  );
  if (!match?.[1]) return null;

  const payload = match[1].trim();
  if (!payload.startsWith("{") && !payload.startsWith("[")) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function parseJsonOrJsonp(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return unwrapJsonp(input);
  }
}
