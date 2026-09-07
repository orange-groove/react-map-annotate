"use client";

import { Trash2, X } from "lucide-react";
import { useOptionalAnnotate } from "../session/annotate-context";
import {
  DEFAULT_COLOR,
  DEFAULT_LABELS,
  DEFAULT_STROKE_WIDTH,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
} from "../core/constants";
import type {
  AnnotateFont,
  AnnotateListProps,
  Annotation,
  AnnotationStyle,
} from "../core/types";
import { cssColorForInput, isArrowAnnotation } from "../core/utils/annotations";
import { fontPickerOptions, resolveAnnotateFonts } from "../core/utils/fonts";

export function AnnotateList({
  annotations: annotationsProp,
  selectedId: selectedIdProp,
  onSelect: onSelectProp,
  onLabelChange: onLabelChangeProp,
  onColorChange: onColorChangeProp,
  onStyleChange: onStyleChangeProp,
  onDelete: onDeleteProp,
  defaultColor = DEFAULT_COLOR,
  emptyMessage = "No annotations",
  fonts: fontsProp,
  className,
  style,
}: AnnotateListProps) {
  const session = useOptionalAnnotate();
  const annotations = annotationsProp ?? session?.annotations ?? [];
  const selectedId =
    selectedIdProp !== undefined
      ? selectedIdProp
      : (session?.selectedId ?? null);
  const onSelect = onSelectProp ?? session?.setSelectedId;
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
  const onStyleChange =
    onStyleChangeProp ??
    (session
      ? (id: string, style: AnnotationStyle) => session.setStyle(id, style)
      : undefined);
  const onDelete = onDeleteProp ?? session?.onDelete;
  const fonts = resolveAnnotateFonts(fontsProp ?? session?.fonts);

  return (
    <div
      className={["rma-list", className].filter(Boolean).join(" ")}
      style={style}
    >
      <div className="rma-list-heading">Annotations</div>
      {annotations.length === 0 ? (
        <p className="rma-list-empty">{emptyMessage}</p>
      ) : (
        <ul className="rma-list-items" aria-label="Annotations">
          {annotations.map((annotation) => (
            <AnnotationRow
              key={annotation.id}
              annotation={annotation}
              selected={selectedId === annotation.id}
              defaultColor={defaultColor}
              onSelect={onSelect}
              onLabelChange={onLabelChange}
              onColorChange={onColorChange}
              onStyleChange={onStyleChange}
              onDelete={onDelete}
              fonts={fonts}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AnnotationRow({
  annotation,
  selected,
  defaultColor,
  onSelect,
  onLabelChange,
  onColorChange,
  onStyleChange,
  onDelete,
  fonts,
}: {
  annotation: Annotation;
  selected: boolean;
  defaultColor: string;
  onSelect?: (id: string) => void;
  onLabelChange?: (id: string, label: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onStyleChange?: (id: string, style: AnnotationStyle) => void;
  onDelete?: (id: string) => void;
  fonts: AnnotateFont[];
}) {
  const color = cssColorForInput(annotation.style?.color, defaultColor);
  const kind = DEFAULT_LABELS[annotation.kind];
  const fontFamily = annotation.style?.fontFamily ?? "";
  const fontOptions = fontPickerOptions(fonts, fontFamily);

  return (
    <li
      className={["rma-list-item", selected ? "rma-list-item--selected" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-selected={selected}
      onPointerDown={() => onSelect?.(annotation.id)}
    >
      <span className="rma-list-kind">{kind}</span>
      <input
        type="color"
        className="rma-list-color"
        value={color}
        aria-label={`Color for ${annotation.label || kind}`}
        title="Color"
        onChange={(event) => onColorChange?.(annotation.id, event.target.value)}
      />
      <div className="rma-list-label-wrap">
        <input
          className="rma-list-label"
          value={annotation.label}
          aria-label={`Label for ${kind}`}
          onChange={(event) =>
            onLabelChange?.(annotation.id, event.target.value)
          }
        />
        {annotation.label && onLabelChange ? (
          <button
            type="button"
            className="rma-list-clear"
            aria-label={`Clear label for ${kind}`}
            title="Clear label"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onLabelChange?.(annotation.id, "")}
          >
            <X size={12} strokeWidth={1.8} aria-hidden />
          </button>
        ) : null}
      </div>
      {onDelete ? (
        <button
          type="button"
          className="rma-list-delete"
          aria-label={`Delete ${annotation.label || kind}`}
          title="Delete"
          onClick={() => onDelete(annotation.id)}
        >
          <Trash2 size={14} strokeWidth={1.8} aria-hidden />
        </button>
      ) : null}
      {annotation.kind === "text" ? (
        <select
          className="rma-list-font"
          value={fontFamily}
          aria-label={`Font for ${annotation.label || kind}`}
          onChange={(event) =>
            onStyleChange?.(annotation.id, {
              fontFamily: event.target.value || undefined,
            })
          }
        >
          {fontOptions.map((option) => (
            <option key={option.family || "system"} value={option.family}>
              {option.label ?? option.family}
            </option>
          ))}
        </select>
      ) : null}
      {isArrowAnnotation(annotation) ? (
        <input
          type="range"
          className="rma-list-size"
          min={MIN_STROKE_WIDTH}
          max={MAX_STROKE_WIDTH}
          step={1}
          value={annotation.style?.strokeWidth ?? DEFAULT_STROKE_WIDTH}
          aria-label={`Size for ${annotation.label || kind}`}
          title="Size"
          onChange={(event) =>
            onStyleChange?.(annotation.id, {
              strokeWidth: Number(event.target.value),
            })
          }
        />
      ) : null}
    </li>
  );
}
