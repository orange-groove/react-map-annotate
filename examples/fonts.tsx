import type { ReactNode } from "react";
import {
  AnnotateProvider,
  TEXT_FONTS,
  type AnnotateFont,
} from "@orange-groove/react-map-annotate/core";

const fonts: AnnotateFont[] = [
  ...TEXT_FONTS,
  {
    family: '"Inter"',
    label: "Inter",
    stylesheet:
      "https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap",
  },
  {
    family: "Outfit",
    label: "Outfit",
    source: "url(/fonts/outfit.woff2)",
  },
];

export function MapWithBrandFonts({ children }: { children: ReactNode }) {
  return (
    <AnnotateProvider fonts={fonts} defaultFontFamily='"Inter"'>
      {children}
    </AnnotateProvider>
  );
}
