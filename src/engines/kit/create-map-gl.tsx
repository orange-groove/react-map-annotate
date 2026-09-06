import type { ComponentType } from "react";
import { Annotate } from "../../interaction/annotate";
import { AnnotateLayers } from "../../paint/gl-layers";
import { AnnotationLabel } from "../../paint/annotation-label";
import { bindMapGl } from "./context";
import type { GlAnnotateLayersProps, GlKit } from "./types";

export function createMapGlComponents(
  kit: GlKit,
  layers: ComponentType<GlAnnotateLayersProps> = AnnotateLayers,
) {
  const next: GlKit = { ...kit, Layers: layers };
  return {
    Annotate: bindMapGl(next, Annotate),
    AnnotateLayers: bindMapGl(next, layers),
    AnnotationLabel: bindMapGl(next, AnnotationLabel),
  };
}
