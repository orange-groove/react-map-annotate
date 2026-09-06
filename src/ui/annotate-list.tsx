"use client";

import { useOptionalAnnotate } from "../session/annotate-context";
import { DEFAULT_COLOR, DEFAULT_LABELS } from "../core/constants";
import type { AnnotateListProps, Annotation } from "../core/types";
import { cssColorForInput } from "../core/utils/annotations";

export function AnnotateList({
  annotations: annotationsProp,
  onLabelChange: onLabelChangeProp,
  onColorChange: onColorChangeProp,
  onDelete: onDeleteProp,
  defaultColor = DEFAULT_COLOR,
  emptyMessage = "No annotations",
  className,
  style,
}: AnnotateListProps) {
  const session = useOptionalAnnotate();
  const annotations = annotationsProp ?? session?.annotations ?? [];
  const onLabelChange =
    onLabelChangeProp ??
    (session
      ? (id: string, label: string) => session.setLabel(id, label)
      : undefined);
  const onColorChange =
    onColorChangeProp ??
    (session
      ? (id: string, color: string) => session.setColor(id, color)
      : undefined);
  const onDelete = onDeleteProp ?? session?.onDelete;

  return (
    <div
      className={["rmga-list", className].filter(Boolean).join(" ")}
      style={style}
    >
      <div className="rmga-list-heading">Annotations</div>
      {annotations.length === 0 ? (
        <p className="rmga-list-empty">{emptyMessage}</p>
      ) : (
        <ul className="rmga-list-items" aria-label="Annotations">
          {annotations.map((annotation) => (
            <AnnotationRow
              key={annotation.id}
              annotation={annotation}
              defaultColor={defaultColor}
              onLabelChange={onLabelChange}
              onColorChange={onColorChange}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AnnotationRow({
  annotation,
  defaultColor,
  onLabelChange,
  onColorChange,
  onDelete,
}: {
  annotation: Annotation;
  defaultColor: string;
  onLabelChange?: (id: string, label: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onDelete?: (id: string) => void;
}) {
  const color = cssColorForInput(annotation.style?.color, defaultColor);
  const kind = DEFAULT_LABELS[annotation.kind];

  return (
    <li className="rmga-list-item">
      <input
        type="color"
        className="rmga-list-color"
        value={color}
        aria-label={`Color for ${annotation.label || kind}`}
        title="Color"
        onChange={(event) => onColorChange?.(annotation.id, event.target.value)}
      />
      <div className="rmga-list-fields">
        <span className="rmga-list-kind">{kind}</span>
        <input
          className="rmga-list-label"
          value={annotation.label}
          aria-label={`Label for ${kind}`}
          onChange={(event) =>
            onLabelChange?.(annotation.id, event.target.value)
          }
        />
      </div>
      {onDelete ? (
        <button
          type="button"
          className="rmga-list-delete"
          aria-label={`Delete ${annotation.label || kind}`}
          title="Delete"
          onClick={() => onDelete(annotation.id)}
        >
          ×
        </button>
      ) : null}
    </li>
  );
}
