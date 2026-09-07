"use client";

import type { GlMarkerProps } from "../kit/types";
import { useMapGl } from "../kit/context";

function DefaultPin({ color, scale = 1 }: { color?: string; scale?: number }) {
  return (
    <svg width={27 * scale} height={40 * scale} viewBox="0 0 27 40" aria-hidden>
      <path
        d="M13.5 0 C6 0 0 6.2 0 13.8 C0 24.2 13.5 40 13.5 40 S27 24.2 27 13.8 C27 6.2 21 0 13.5 0 Z"
        fill={color ?? "#ea4335"}
        stroke="#ffffff"
        strokeWidth="1.25"
      />
      <circle cx="13.5" cy="13.5" r="4.2" fill="#ffffff" />
    </svg>
  );
}

export function arcgisMarkerAnchor(
  anchor?: string,
  pin = false,
): { anchorLeft: string; anchorTop: string } {
  if (pin || anchor === "bottom") {
    return { anchorLeft: "-50%", anchorTop: "-100%" };
  }
  if (anchor === "top") {
    return { anchorLeft: "-50%", anchorTop: "0%" };
  }
  if (anchor === "left") {
    return { anchorLeft: "0%", anchorTop: "-50%" };
  }
  if (anchor === "right") {
    return { anchorLeft: "-100%", anchorTop: "-50%" };
  }
  return { anchorLeft: "-50%", anchorTop: "-50%" };
}

export function ArcgisMarker({
  longitude,
  latitude,
  anchor = "center",
  offset = [0, 0],
  color,
  scale = 1,
  style,
  onClick,
  children,
}: GlMarkerProps) {
  const { useMap } = useMapGl();
  const maps = useMap();
  const map = maps.current?.getMap();
  const pin = children == null;
  const { anchorLeft, anchorTop } = arcgisMarkerAnchor(anchor, pin);
  const point = map?.projectDiv?.({ lng: longitude, lat: latitude }) ??
    map?.project({ lng: longitude, lat: latitude }) ?? { x: 0, y: 0 };

  return (
    <div
      className="rma-overlay-marker"
      style={{
        position: "absolute",
        left: point.x,
        top: point.y,
        transform: `translate(${anchorLeft}, ${anchorTop}) translate(${offset[0]}px, ${offset[1]}px)`,
        ...style,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.({ originalEvent: event.nativeEvent });
      }}
    >
      {children ?? <DefaultPin color={color} scale={pin ? scale : 1} />}
    </div>
  );
}
