import { useMemo } from "react";
import { useMap } from "react-leaflet";
import { getLeafletMapLike } from "./map-like";

export function useLeafletMapRef() {
  const map = useMap();
  return useMemo(
    () => ({
      current: { getMap: () => getLeafletMapLike(map) },
    }),
    [map],
  );
}
