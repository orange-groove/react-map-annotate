export function createAnnotationId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `rma-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
