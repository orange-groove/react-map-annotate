import { SELECTABLE_LAYER_IDS } from "../core/constants";
import type { Annotation } from "../core/types";
import type { MapPoint } from "../core/types";
import { hitEditHandle, type EditHandleHit } from "../core/utils/edit";
import { hitTestAnnotations } from "../core/utils/hit-test";
import type { MapLike } from "../engines/kit/types";

export function annotationHandleAt(
  map: MapLike,
  point: MapPoint,
  annotation: Annotation | undefined,
) {
  if (!annotation) return null;
  return hitEditHandle((lngLat) => map.project(lngLat), point, annotation);
}

export function resolveHandleTarget(
  map: MapLike,
  point: MapPoint,
  items: Annotation[],
  hoverId: string | null,
  bodyId: string | null,
): { annotation: Annotation; handle: EditHandleHit } | null {
  const hover = hoverId ? items.find((item) => item.id === hoverId) : undefined;
  const hoverHandle = annotationHandleAt(map, point, hover);
  if (hover && hoverHandle) {
    return { annotation: hover, handle: hoverHandle };
  }
  if (bodyId && bodyId !== hoverId) {
    const body = items.find((item) => item.id === bodyId);
    const bodyHandle = annotationHandleAt(map, point, body);
    if (body && bodyHandle) {
      return { annotation: body, handle: bodyHandle };
    }
  }
  return null;
}

export function hitAnnotationId(
  map: MapLike,
  point: MapPoint,
  annotations: Annotation[],
) {
  const layers = SELECTABLE_LAYER_IDS.filter((id) => Boolean(map.getLayer(id)));
  if (layers.length > 0) {
    const id = map.queryRenderedFeatures(point, { layers })[0]?.properties?.id;
    if (
      typeof id === "string" &&
      id !== "draft" &&
      !id.startsWith("draft-") &&
      !id.startsWith("group-")
    ) {
      return id;
    }
  }
  return hitTestAnnotations(
    (lngLat) => map.project(lngLat),
    point,
    annotations,
  );
}
