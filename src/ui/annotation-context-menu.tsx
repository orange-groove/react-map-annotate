"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function AnnotationContextMenu({
  x,
  y,
  canDuplicate,
  canCopy,
  canPaste,
  canDelete,
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  canDuplicate: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDelete: boolean;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const left = Math.min(x, window.innerWidth - 168);
  const top = Math.min(y, window.innerHeight - 180);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={rootRef}
      className="rma-menu"
      data-rma-menu=""
      role="menu"
      aria-label="Annotation"
      style={{ left, top }}
    >
      <button
        type="button"
        role="menuitem"
        className="rma-menu-item"
        disabled={!canDuplicate}
        onClick={onDuplicate}
      >
        Duplicate
      </button>
      <button
        type="button"
        role="menuitem"
        className="rma-menu-item"
        disabled={!canCopy}
        onClick={onCopy}
      >
        Copy
      </button>
      <button
        type="button"
        role="menuitem"
        className="rma-menu-item"
        disabled={!canPaste}
        onClick={onPaste}
      >
        Paste
      </button>
      <button
        type="button"
        role="menuitem"
        className="rma-menu-item rma-menu-item--danger"
        disabled={!canDelete}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>,
    document.body,
  );
}
