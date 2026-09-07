import { TEXT_FONTS } from "../constants";
import type { AnnotateFont } from "../types";

export function resolveAnnotateFonts(fonts?: AnnotateFont[]): AnnotateFont[] {
  return fonts ?? TEXT_FONTS;
}

export function fontPickerOptions(
  fonts: AnnotateFont[],
  current?: string,
): AnnotateFont[] {
  if (current && !fonts.some((font) => font.family === current)) {
    return [...fonts, { family: current, label: current }];
  }
  return fonts;
}

export function fontStylesheetHrefs(fonts: AnnotateFont[]): string[] {
  const hrefs: string[] = [];
  for (const font of fonts) {
    if (font.stylesheet && !hrefs.includes(font.stylesheet)) {
      hrefs.push(font.stylesheet);
    }
  }
  return hrefs;
}

export function fontFaceFamilyName(family: string): string {
  const first = family.split(",")[0]?.trim() ?? family;
  return first.replace(/^["']|["']$/g, "");
}

export function loadAnnotateFontFaces(fonts: AnnotateFont[]): () => void {
  const faces = globalThis.document?.fonts;
  if (!faces || typeof FontFace === "undefined") return () => undefined;

  const loaded: FontFace[] = [];
  for (const font of fonts) {
    if (!font.source) continue;
    const name = fontFaceFamilyName(font.family);
    if (!name) continue;
    const face = new FontFace(name, font.source);
    faces.add(face);
    void face.load().catch(() => undefined);
    loaded.push(face);
  }

  return () => {
    for (const face of loaded) {
      faces.delete(face);
    }
  };
}
