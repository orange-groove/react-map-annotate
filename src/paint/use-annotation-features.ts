"use client";

import * as React from "react";
import {
  buildAnnotationFeatures,
  type AnnotationFeatures,
} from "../core/utils/features";

type Params = Parameters<typeof buildAnnotationFeatures>[0];

function sameFeatures(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((feature, index) => feature === b[index]);
}

function reuse<T extends { features: readonly unknown[] }>(
  previous: T | undefined,
  next: T,
): T {
  return previous && sameFeatures(previous.features, next.features)
    ? previous
    : next;
}

/**
 * Feature collections that keep their identity when their contents have not
 * changed.
 *
 * Map bindings upload a source when the `data` object changes. Rebuilding all
 * six collections every frame of a drag re-uploads all six, when at most one
 * of them holds the annotation being dragged. Handing back the previous object
 * for the untouched sources turns those uploads into no-ops.
 */
export function useAnnotationFeatures(params: Params): AnnotationFeatures {
  const previousRef = React.useRef<AnnotationFeatures | undefined>(undefined);
  const next = buildAnnotationFeatures(params);
  const previous = previousRef.current;
  const stable: AnnotationFeatures = {
    lines: reuse(previous?.lines, next.lines),
    fills: reuse(previous?.fills, next.fills),
    dashed: reuse(previous?.dashed, next.dashed),
    bounds: reuse(previous?.bounds, next.bounds),
    samples: reuse(previous?.samples, next.samples),
    arrows:
      previous && sameFeatures(previous.arrows, next.arrows)
        ? previous.arrows
        : next.arrows,
    markers:
      previous && sameFeatures(previous.markers, next.markers)
        ? previous.markers
        : next.markers,
  };
  previousRef.current = stable;
  return stable;
}
