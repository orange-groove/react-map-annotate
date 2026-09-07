import { create } from "zustand";
import Map from "react-map-gl/mapbox";
import {
  AnnotateProvider,
  type Annotation,
} from "@orange-groove/react-map-annotate/core";
import { Annotate } from "@orange-groove/react-map-annotate/mapbox";

const useAnnotations = create<{
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
}>((set) => ({
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
}));

export function ZustandMap({ token }: { token: string }) {
  const annotations = useAnnotations((state) => state.annotations);
  const setAnnotations = useAnnotations((state) => state.setAnnotations);

  return (
    <AnnotateProvider annotations={annotations} onChange={setAnnotations}>
      <Map mapboxAccessToken={token} /* ... */>
        <Annotate />
      </Map>
    </AnnotateProvider>
  );
}
