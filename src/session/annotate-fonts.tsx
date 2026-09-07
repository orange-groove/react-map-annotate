"use client";

import { useEffect } from "react";
import type { AnnotateFont } from "../core/types";
import {
  fontStylesheetHrefs,
  loadAnnotateFontFaces,
} from "../core/utils/fonts";

export function AnnotateFontLoader({ fonts }: { fonts: AnnotateFont[] }) {
  const hrefs = fontStylesheetHrefs(fonts);

  useEffect(() => loadAnnotateFontFaces(fonts), [fonts]);

  if (hrefs.length === 0) return null;

  return (
    <>
      {hrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}
