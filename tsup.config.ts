import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core.ts",
    mapbox: "src/mapbox.ts",
    maplibre: "src/maplibre.ts",
    google: "src/google.ts",
    leaflet: "src/leaflet.ts",
    arcgis: "src/arcgis.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react-map-gl",
    "react-map-gl/mapbox",
    "react-map-gl/maplibre",
    "@vis.gl/react-google-maps",
    "mapbox-gl",
    "maplibre-gl",
    "leaflet",
    "react-leaflet",
    "@arcgis/core",
    "lucide-react",
  ],
});
