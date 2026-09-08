import type { Annotation } from "../types";
import { createAnnotationId } from "./ids";

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function modifierSource(event?: unknown): {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  getModifierState?: (key: string) => boolean;
} | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  for (const key of ["originalEvent", "nativeEvent", "domEvent"] as const) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      return nested as {
        shiftKey?: boolean;
        metaKey?: boolean;
        ctrlKey?: boolean;
        getModifierState?: (key: string) => boolean;
      };
    }
  }
  return record as {
    shiftKey?: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
    getModifierState?: (key: string) => boolean;
  };
}

function sourceIsAdditive(source: {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  getModifierState?: (key: string) => boolean;
}): boolean {
  if (source.shiftKey || source.metaKey || source.ctrlKey) return true;
  if (typeof source.getModifierState !== "function") return false;
  return (
    source.getModifierState("Shift") ||
    source.getModifierState("Meta") ||
    source.getModifierState("Control")
  );
}

export function isAdditiveSelect(event?: unknown): boolean {
  if (!event || typeof event !== "object") return false;
  const record = event as Record<string, unknown>;
  if (sourceIsAdditive(record as { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean })) {
    return true;
  }
  const native = modifierSource(event);
  return native != null && sourceIsAdditive(native);
}

export function idIsSelected(
  id: string,
  selectedIds?: string[],
  selectedId?: string | null,
): boolean {
  if (selectedIds && selectedIds.length > 0) return selectedIds.includes(id);
  return id === selectedId;
}

export function expandGroupIds(
  annotations: Annotation[],
  ids: string[],
): string[] {
  const wanted = new Set(ids);
  const groups = new Set(
    annotations
      .filter((item) => wanted.has(item.id) && item.groupId)
      .map((item) => item.groupId as string),
  );
  if (groups.size === 0) return uniqueIds(ids);
  return annotations
    .filter(
      (item) => wanted.has(item.id) || (item.groupId && groups.has(item.groupId)),
    )
    .map((item) => item.id);
}

export function toggleSelectedIds(
  annotations: Annotation[],
  current: string[],
  id: string,
): string[] {
  const chunk = expandGroupIds(annotations, [id]);
  const selected = new Set(current);
  const allOn = chunk.every((item) => selected.has(item));
  if (allOn) {
    for (const item of chunk) selected.delete(item);
  } else {
    for (const item of chunk) selected.add(item);
  }
  return [...selected];
}

export function nextSelectedIds(
  annotations: Annotation[],
  current: string[],
  id: string | null,
  additive = false,
): string[] {
  if (id == null) return additive ? current : [];
  if (additive) return toggleSelectedIds(annotations, current, id);
  return expandGroupIds(annotations, [id]);
}

export function groupAnnotations(
  annotations: Annotation[],
  ids: string[],
): Annotation[] {
  const selected = new Set(expandGroupIds(annotations, ids));
  if (selected.size < 2) return annotations;
  const groupId = createAnnotationId();
  return annotations.map((item) =>
    selected.has(item.id) ? { ...item, groupId } : item,
  );
}

export function ungroupAnnotations(
  annotations: Annotation[],
  ids: string[],
): Annotation[] {
  const groups = new Set(
    annotations
      .filter((item) => ids.includes(item.id) && item.groupId)
      .map((item) => item.groupId as string),
  );
  if (groups.size === 0) return annotations;
  return annotations.map((item) =>
    item.groupId && groups.has(item.groupId)
      ? { ...item, groupId: undefined }
      : item,
  );
}

export function canGroupIds(ids: string[]): boolean {
  return ids.length >= 2;
}

export function canGroupAnnotations(
  annotations: Annotation[],
  ids: string[],
): boolean {
  if (ids.length < 2) return false;
  const members = annotations.filter((item) => ids.includes(item.id));
  if (members.length < 2) return false;
  const first = members[0]?.groupId;
  return first == null || members.some((item) => item.groupId !== first);
}

export function canUngroupAnnotations(
  annotations: Annotation[],
  ids: string[],
): boolean {
  return annotations.some((item) => ids.includes(item.id) && item.groupId);
}

export function remapPastedGroupIds(annotations: Annotation[]): Annotation[] {
  const groups = new Map<string, string>();
  return annotations.map((item) => {
    if (!item.groupId) return item;
    const next = groups.get(item.groupId) ?? createAnnotationId();
    groups.set(item.groupId, next);
    return { ...item, groupId: next };
  });
}

export function unionSelectedIds(
  annotations: Annotation[],
  current: string[],
  incoming: string[],
): string[] {
  return expandGroupIds(annotations, uniqueIds([...current, ...incoming]));
}
