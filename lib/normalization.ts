export function normalizeIdentifier(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "").trim();
}
