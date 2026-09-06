import { useMemo } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { getGoogleMapLike } from "./map-like";

export function useGoogleMapRef() {
  const map = useMap();
  return useMemo(
    () => ({
      current: map ? { getMap: () => getGoogleMapLike(map) } : null,
    }),
    [map],
  );
}
