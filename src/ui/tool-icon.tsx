"use client";

import type { AnnotateTool } from "../core/types";

export function AnnotateToolIcon({
  tool,
  size = 18,
}: {
  tool: AnnotateTool;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (tool) {
    case "select":
      return (
        <svg {...common}>
          <path
            d="M5 3 L5 19 L9.2 15.2 L12.2 21.2 L14.6 20 L11.6 14 L17 14 Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
    case "draw":
      return (
        <svg {...common}>
          <path d="M4 16 C7 8 10 18 13 10 C15 6 18 8 20 7" />
        </svg>
      );
    case "line":
      return (
        <svg {...common}>
          <path d="M5 18 L19 6" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M4 18 L17 7" />
          <path d="M11 6.5 L17 7 L16 13" />
        </svg>
      );
    case "bidirectional-arrow":
      return (
        <svg {...common}>
          <path d="M7 16 L17 8" />
          <path d="M11 7 L17 8 L16 14" />
          <path d="M13 17 L7 16 L8 10" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case "rectangle":
      return (
        <svg {...common}>
          <rect x="5" y="6" width="14" height="12" rx="1.5" />
        </svg>
      );
    case "polygon":
      return (
        <svg {...common}>
          <path d="M8 4 L18 7 L16 18 L6 16 L5 9 Z" />
        </svg>
      );
    case "measure":
      return (
        <svg {...common}>
          <path d="M4 16 L20 8" />
          <path d="M7 14.5 L6 12.4" />
          <path d="M11 12.5 L10 10.4" />
          <path d="M15 10.5 L14 8.4" />
        </svg>
      );
    case "marker":
      return (
        <svg {...common}>
          <path d="M12 21 C12 21 6.5 14.6 6.5 10.2 A5.5 5.5 0 0 1 17.5 10.2 C17.5 14.6 12 21 12 21 Z" />
          <circle cx="12" cy="10.2" r="1.8" />
        </svg>
      );
    default:
      return null;
  }
}
