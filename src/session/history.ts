import type { Annotation } from "../core/types";

export const HISTORY_LIMIT = 50;

export function cloneAnnotations(items: Annotation[]): Annotation[] {
  return structuredClone(items);
}

export function annotationsEqual(a: Annotation[], b: Annotation[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
