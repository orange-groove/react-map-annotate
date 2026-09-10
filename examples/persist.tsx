import { useEffect, useState } from "react";
import Map from "react-map-gl/mapbox";
import {
  AnnotateProvider,
  type Annotation,
} from "@orange-groove/react-map-annotate/core";
import { Annotate } from "@orange-groove/react-map-annotate/mapbox";

export function PersistAnnotations({ token }: { token: string }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    void fetch("/api/annotations")
      .then((response) => response.json())
      .then(setAnnotations);
  }, []);

  return (
    <AnnotateProvider
      annotations={annotations}
      onChange={setAnnotations}
      onCommit={(next) => {
        void fetch("/api/annotations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
      }}
    >
      <Map mapboxAccessToken={token} /* ... */>
        <Annotate />
      </Map>
    </AnnotateProvider>
  );
}
