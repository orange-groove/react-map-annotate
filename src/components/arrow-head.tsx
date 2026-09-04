"use client";

import type { ArrowHeadRenderProps } from "../types";

export function DefaultArrowHead({
  bearing,
  color,
  size,
}: ArrowHeadRenderProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{
        display: "block",
        overflow: "visible",
        transform: `rotate(${bearing}deg)`,
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
      }}
    >
      <path
        d="M12 2.2 L20.4 18.4 C20.7 19 20.2 19.7 19.5 19.5 L12 16.8 L4.5 19.5 C3.8 19.7 3.3 19 3.6 18.4 Z"
        fill={color}
        stroke="#ffffff"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}
