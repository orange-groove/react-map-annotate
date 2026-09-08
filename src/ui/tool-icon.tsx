"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Circle,
  Hand,
  MapPin,
  MousePointer2,
  MoveDiagonal,
  Pencil,
  Pentagon,
  Ruler,
  Slash,
  Square,
  Type,
  Waypoints,
} from "lucide-react";
import type { AnnotateTool } from "../core/types";

const ICONS: Record<AnnotateTool, LucideIcon> = {
  pan: Hand,
  select: MousePointer2,
  draw: Pencil,
  trace: Waypoints,
  line: Slash,
  arrow: ArrowUpRight,
  "bidirectional-arrow": MoveDiagonal,
  circle: Circle,
  rectangle: Square,
  polygon: Pentagon,
  measure: Ruler,
  marker: MapPin,
  text: Type,
};

export function AnnotateToolIcon({
  tool,
  size = 18,
}: {
  tool: AnnotateTool;
  size?: number;
}) {
  const Icon = ICONS[tool];
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}
