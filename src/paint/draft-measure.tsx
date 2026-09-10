"use client";

import type { DraftAnnotation } from "../core/types";
import { previewCoordinates } from "../core/utils/annotations";
import { formatDistance, pathLength } from "../core/utils/geo";
import { useMapGl } from "../engines/kit/context";

/**
 * The running length of a measure that has not been committed yet, painted at
 * the head of the path so it follows the pointer. Geodesic from the vertices
 * alone: terrain sampling is too expensive per frame and waits for the commit,
 * which is also when `caption` takes over.
 */
export function DraftMeasure({ draft }: { draft?: DraftAnnotation | null }) {
  const { Marker } = useMapGl();
  if (draft?.kind !== "measure") return null;
  const coordinates = previewCoordinates(draft);
  if (coordinates.length < 2) return null;
  const meters = pathLength(coordinates);
  if (meters <= 0) return null;
  const head = coordinates[coordinates.length - 1];

  return (
    <Marker
      longitude={head[0]}
      latitude={head[1]}
      anchor="bottom"
      offset={[0, -18]}
    >
      <div className="rma-draft-measure">{formatDistance(meters)}</div>
    </Marker>
  );
}
