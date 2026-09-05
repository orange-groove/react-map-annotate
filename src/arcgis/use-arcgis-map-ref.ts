import { useMemo } from "react";
import { getArcgisMapLike } from "./map-like";
import { useArcgisView } from "./view-context";

export function useArcgisMapRef() {
  const view = useArcgisView();
  return useMemo(
    () => ({
      current: view ? { getMap: () => getArcgisMapLike(view) } : null,
    }),
    [view],
  );
}
