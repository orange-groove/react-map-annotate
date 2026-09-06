"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { GlMarkerProps } from "../kit/types";
import { leafletMarkerShift } from "./path";

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

export function LeafletMarker({
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
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const pin = children == null;

  useEffect(() => {
    const icon = L.divIcon({
      className: "rmga-leaflet-marker",
      html: "",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const marker = L.marker([latitude, longitude], {
      icon,
      keyboard: false,
      interactive: true,
    }).addTo(map);
    marker.on("click", (event) => {
      L.DomEvent.stop(event);
      onClickRef.current?.({
        originalEvent: event.originalEvent,
      });
    });
    markerRef.current = marker;
    setContainer(marker.getElement() ?? null);
    return () => {
      marker.remove();
      markerRef.current = null;
      setContainer(null);
    };
    // Recreate only when the map instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- position updates below
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

  useEffect(() => {
    if (typeof style?.zIndex === "number") {
      markerRef.current?.setZIndexOffset(style.zIndex);
    }
  }, [style?.zIndex]);

  const offsetX = offset[0];
  const offsetY = offset[1];

  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const next = leafletMarkerShift(
      el.offsetWidth,
      el.offsetHeight,
      anchor,
      pin,
      [offsetX, offsetY],
    );
    setShift((current) =>
      current.x === next.x && current.y === next.y ? current : next,
    );
  }, [anchor, pin, offsetX, offsetY, children, container, color, scale]);

  if (!container) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="rmga-overlay-marker"
      style={{
        display: "block",
        width: "max-content",
        height: "max-content",
        transform: `translate(${shift.x}px, ${shift.y}px)`,
        ...style,
      }}
    >
      {children ?? <DefaultPin color={color} scale={pin ? scale : 1} />}
    </div>,
    container,
  );
}
