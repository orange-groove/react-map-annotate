# @orange-groove/react-map-annotate

Draw on Mapbox, MapLibre, Google, Leaflet, or ArcGIS. The map only paints. **You**
choose the tool, finish the shape, and persist `Annotation[]` like any other
React state.

[![npm](https://img.shields.io/npm/v/@orange-groove/react-map-annotate)](https://www.npmjs.com/package/@orange-groove/react-map-annotate)
[![demo](https://img.shields.io/badge/demo-live-brightgreen)](https://react-map-annotate-demo.onrender.com/)
[![CI](https://github.com/orange-groove/react-map-annotate/actions/workflows/ci.yml/badge.svg)](https://github.com/orange-groove/react-map-annotate/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@orange-groove/react-map-annotate)](./LICENSE)

[Live demo](https://react-map-annotate-demo.onrender.com/) — Mapbox, MapLibre, Google, Leaflet, and ArcGIS.

**Status:** 0.3 is the public API. Pin the version. The session contract —
`Annotation[]`, `setTool`, `finish`, `onChange` — is what we intend to keep.
Other surfaces can still change before 1.0; see the [changelog](./CHANGELOG.md)
and [GitHub Releases](https://github.com/orange-groove/react-map-annotate/releases).

![A custom toolbar drawing a polygon; the annotations array updates in React state](./docs/demo.gif)

Your buttons call `setTool("polygon")` and `finish()`. The map draws. `onChange`
gives you the same `Annotation[]` you would save to a database.

## Install

```bash
npm install @orange-groove/react-map-annotate
```

Peers: `react` and `react-dom` ≥ 18. Import the CSS once, or skip it and style
the session yourself.

```ts
import "@orange-groove/react-map-annotate/styles.css";
```

| Map      | Also install                                          |
| -------- | ----------------------------------------------------- |
| Mapbox   | `react-map-gl` ≥ 8, `mapbox-gl` ≥ 3                   |
| MapLibre | `react-map-gl` ≥ 8, `maplibre-gl` ≥ 4                 |
| Google   | `@vis.gl/react-google-maps` ≥ 1                       |
| Leaflet  | `leaflet` ≥ 1.9, `react-leaflet` ≥ 4 (v5 on React 19) |
| ArcGIS   | `@arcgis/core` ≥ 4.28                                 |

## Quick start

The first snippet is headless on purpose. Stock chrome is below if you want a
toolbar today.

```tsx
import { useState } from "react";
import Map from "react-map-gl/mapbox";
import {
  AnnotateProvider,
  useAnnotate,
  type Annotation,
} from "@orange-groove/react-map-annotate/core";
import { Annotate } from "@orange-groove/react-map-annotate/mapbox";
import "@orange-groove/react-map-annotate/styles.css";

function FenceControls() {
  const { setTool, finish, canFinish } = useAnnotate();
  return (
    <>
      <button type="button" onClick={() => setTool("polygon")}>
        Fence
      </button>
      <button type="button" disabled={!canFinish} onClick={finish}>
        Done
      </button>
    </>
  );
}

export function MapWithDraw({ token }: { token: string }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  return (
    <AnnotateProvider annotations={annotations} onChange={setAnnotations}>
      <Map
        mapboxAccessToken={token}
        initialViewState={{ longitude: -73.9857, latitude: 40.7484, zoom: 14 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
      >
        <Annotate />
      </Map>
      <FenceControls />
    </AnnotateProvider>
  );
}
```

`Annotate` must be a child of `Map`. Controls can live anywhere under
`AnnotateProvider`.

### Fast start: stock toolbar and list

```tsx
import {
  AnnotateList,
  AnnotateToolbar,
} from "@orange-groove/react-map-annotate/core";

<AnnotateProvider annotations={annotations} onChange={setAnnotations}>
  <Map mapboxAccessToken={token} /* ... */>
    <Annotate />
  </Map>
  <AnnotateToolbar />
  <AnnotateList />
</AnnotateProvider>;
```

Those two components are example consumers of `useAnnotateTools()` and
`useAnnotateItems()`. Replace them when your design system shows up. Full
samples: [`examples/`](./examples).

## Compare

[Terra Draw](https://github.com/JamesLMilner/terra-draw) is a capable
adapter-based drawing engine. You can drive it from your own UI (`setMode`,
`addFeatures`) and read GeoJSON from its store. Use it when you want that
control without a React session, or when you need OpenLayers.

This library is for when the drawing session itself is React state: the same
`Annotation[]` your toolbar, list, and database already speak.

|                       | This library                                                                 | Terra Draw                                                                                             | Mapbox GL Draw                                                | Leaflet.Draw                        | Google Drawing Manager                      |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| React state ownership | `Annotation[]` on the provider. `onChange` is the write path.                | Internal GeoJSON store. Snapshot it (`getSnapshot`) and subscribe to change events to sync into React. | Draw's feature store (`getAll` / `set`). Sync out via events. | Layers on the map.                  | Overlay objects on the map.                 |
| Custom UI APIs        | Headless hooks: `useAnnotate()`, `useAnnotateTools()`, `useAnnotateItems()`. | Imperative instance API. Fully controllable; no React hooks.                                           | `changeMode`; hide or restyle the default control.            | Custom `L.Control`, or hide theirs. | `drawingControl: false` + `setDrawingMode`. |
| Supported engines     | Mapbox, MapLibre, Google, Leaflet, ArcGIS                                    | Mapbox, MapLibre, Google, Leaflet, OpenLayers                                                          | Mapbox (MapLibre via community ports)                         | Leaflet                             | Google Maps                                 |
| Built-in editing      | Move, vertex drag, mid-edge insert, vertex delete, undo / redo               | Select mode (drag, scale, rotate) plus undo / redo                                                     | `simple_select` / `direct_select`                             | Edit / delete handlers              | Limited after the shape is placed           |
| Measurement           | Geodesic path, 10 m samples, optional terrain elevation                      | Not built in. Measure from the GeoJSON you already have.                                               | Not built in.                                                 | Not built in.                       | Not built in.                               |

Engine-locked managers (Mapbox GL Draw, Leaflet.Draw, Google Drawing Manager)
are the right tool when you want their control on that one map. They were not
built as a React session.

## Recipes

### Build a custom toolbar

```tsx
import { useAnnotate } from "@orange-groove/react-map-annotate/core";

const { setTool, finish, canFinish } = useAnnotate();
setTool("polygon");
finish();
```

For a row of buttons with undo, redo, and icons, use `useAnnotateTools()` —
see [`examples/custom-toolbar.tsx`](./examples/custom-toolbar.tsx). For a
sidebar that names, recolors, and deletes rows, see
[`examples/custom-list.tsx`](./examples/custom-list.tsx).

### Persist annotations to a database

`onChange` fires on add, move, resize, label, color, and delete. Put
`Annotation[]` in the request body. Load the same array back into
`annotations`.

```tsx
<AnnotateProvider
  annotations={annotations}
  onChange={(next) => {
    setAnnotations(next);
    void fetch("/api/annotations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }}
>
```

Granular `onAdd` / `onDelete` / `onLabelChange` / `onColorChange` are there
when you need an audit trail. Full file:
[`examples/persist.tsx`](./examples/persist.tsx).

### Use with Zustand

The provider does not care where the array lives. Pass store getters and
setters as `annotations` / `onChange`.

```tsx
import { create } from "zustand";
import type { Annotation } from "@orange-groove/react-map-annotate/core";

const useAnnotations = create<{
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
}>((set) => ({
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
}));

const annotations = useAnnotations((state) => state.annotations);
const setAnnotations = useAnnotations((state) => state.setAnnotations);

<AnnotateProvider annotations={annotations} onChange={setAnnotations}>
```

[`examples/zustand.tsx`](./examples/zustand.tsx). Redux, Jotai, and
`localStorage` follow the same two props.

### Switch from Mapbox to MapLibre

Keep the provider, hooks, and `Annotation[]`. Change the map component and the
`Annotate` import.

```tsx
import Map from "react-map-gl/maplibre";
import { Annotate } from "@orange-groove/react-map-annotate/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

<Map
  initialViewState={{ longitude: -73.9857, latitude: 40.7484, zoom: 14 }}
  mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
>
  <Annotate />
</Map>;
```

[`examples/maplibre.tsx`](./examples/maplibre.tsx). Other engines:

| Engine   | `Annotate` import                                | Example                                            |
| -------- | ------------------------------------------------ | -------------------------------------------------- |
| Mapbox   | `@orange-groove/react-map-annotate` or `/mapbox` | [`examples/mapbox.tsx`](./examples/mapbox.tsx)     |
| MapLibre | `/maplibre`                                      | [`examples/maplibre.tsx`](./examples/maplibre.tsx) |
| Google   | `/google`                                        | [`examples/google.tsx`](./examples/google.tsx)     |
| Leaflet  | `/leaflet`                                       | [`examples/leaflet.tsx`](./examples/leaflet.tsx)   |
| ArcGIS   | `/arcgis`                                        | [`examples/arcgis.tsx`](./examples/arcgis.tsx)     |

Session imports stay on `/core`. Engine entries still re-export the session so
existing `/mapbox` (and root) imports keep working.

Mapbox `enableTerrain` uses the Mapbox terrain DEM. MapLibre needs an explicit
raster-DEM (`terrainSource`). Terrain is a no-op on Google, Leaflet, and
ArcGIS. Google needs a `mapId` (the public `DEMO_MAP_ID` is enough) so labels
and handles can use Advanced Markers. Leaflet coordinates stay `[lng, lat]` in
your state; isolate the map in a stacking context so panes do not cover your
chrome. ArcGIS: pass the `MapView` through `ArcgisViewProvider` — do not mount
React children inside `MapView.container`. If you render `<arcgis-map>`, put
`<Annotate />` inside it.

### Create a measurement tool

```tsx
const { setTool, finish, canFinish } = useAnnotate();

<button type="button" onClick={() => setTool("measure")}>
  Measure
</button>
<button type="button" disabled={!canFinish} onClick={finish}>
  Done
</button>

<Map /* ... */>
  <Annotate enableTerrain sampleIntervalMeters={10} />
</Map>
```

Two clicks complete a measure. The saved annotation includes geodesic
`distanceMeters` and, with terrain enabled, elevation samples along the path.
[`examples/measure.tsx`](./examples/measure.tsx).

## Fonts

Pass a catalog on `AnnotateProvider`. The stock list uses it, new text can
default to one of your families, and custom UI reads the same list from
`useAnnotateFonts()`.

```tsx
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

<AnnotateProvider fonts={fonts} defaultFontFamily='"Inter"'>
  {/* map, toolbar, list */}
</AnnotateProvider>;
```

`stylesheet` injects a `<link>`. `source` registers a `FontFace`. `family` is
what gets stored on `annotation.style.fontFamily` and applied to the map text.
Omit `fonts` to keep the built-in web-safe list. Spread `TEXT_FONTS` if you
want those plus your own.

```tsx
const fonts = useAnnotateFonts();
item.setStyle({ fontFamily: fonts[1]?.family });
```

## How drawing feels

Pick a tool. Draw. Press **Finish**, Enter, or Escape to commit.

- **Freehand, circle, rectangle** — complete on mouse up.
- **Line, arrow, bidirectional arrow, measure** — complete on the second click.
- **Polygon** — click vertices, then Finish.
- **Marker** — click to drop a pin.
- **Text** — click to place. Type to edit. Corner handle resizes. Color from
  the list.
- **Edit** — hover or select a finished shape to move it. End handles resize
  lines, arrows, and measures. Vertices resize polygons and rectangles. A
  diagonal handle resizes circles. Hollow mid-edge handles insert vertices on
  polygons and paths. Double-click a vertex (or select it and press Delete) to
  remove it. Undo / redo from the toolbar or ⌘Z / ⇧⌘Z. Right-click opens
  Duplicate, Copy, Paste, and Delete. ⌘D / Ctrl+D duplicates the selection to
  the right. ⌘C / Ctrl+C copies it; ⌘V / Ctrl+V pastes at the pointer.

```tsx
<Annotate
  enableTerrain
  defaultColor="#2563eb"
  defaultStrokeWidth={3}
  sampleIntervalMeters={10}
  renderArrowHead={({ bearing, color, size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M12 2 L20 20 L12 16 L4 20 Z"
        fill={color}
        style={{ transform: `rotate(${bearing}deg)` }}
      />
    </svg>
  )}
  renderLabel={({ annotation }) => (
    <span className="chip">{annotation.label}</span>
  )}
/>
```

Measure paths are densified along the geodesic every 10 meters. With terrain
enabled, each sample records ground height.

## Tools

| Tool                  | What it does                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Freehand              | Sketch a path. Hover for a bounds box; drag to move.                                                                               |
| Line                  | Two-click segment. Hover ends to resize.                                                                                           |
| Arrow / bidirectional | Line plus SVG heads. Size from the list, or `setStyle({ strokeWidth })` — widens the shaft and the heads.                          |
| Circle                | Drag to create. Hover for a resize handle.                                                                                         |
| Rectangle             | Drag to create. Hover vertices to resize.                                                                                          |
| Polygon               | Click vertices, Finish to close.                                                                                                   |
| Measure               | Geodesic length, optional terrain samples.                                                                                         |
| Marker                | Labeled map pin. Drag the pin to move it.                                                                                          |
| Text                  | Click to place. Drag to move, corner to resize. Color and font from the list, or `setStyle({ fontFamily })`. Double-click to edit. |
| Finish                | Commit the draft (same as Enter).                                                                                                  |

## API snapshot

| Export               | Role                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| `/core`              | Session, hooks, types, utils, toolbar, list — no `Annotate`.                    |
| `AnnotateProvider`   | Session. Optional `annotations` / `onChange` / `fonts`.                         |
| `Annotate`           | Map child. Drawing, hover handles, layers.                                      |
| `AnnotateToolbar`    | Stock icon toolbar — optional.                                                  |
| `AnnotateList`       | Stock label / color / font / size / delete list — optional.                     |
| `useAnnotate()`      | Full session: `setTool`, `setLabel`, `setStyle`, `fonts`, …                     |
| `useAnnotateTools()` | `{ items, finish, canFinish, deleteSelected, undo, redo }`                      |
| `useAnnotateItems()` | Rows with `isSelected`, `select`, `setLabel`, `setColor`, `setStyle`, `remove`. |
| `useAnnotateFonts()` | Font catalog from the provider.                                                 |
| `AnnotateToolIcon`   | Bundled tool SVG.                                                               |

Types ship with the package: `Annotation`, `AnnotateTool`, `AnnotateSession`,
and the rest.

## Compatibility

CI runs `npm run check` (typecheck, lint, Prettier, Vitest) on Node 20 and 22.
Tests are jsdom unit tests, not live map tiles.

| Package                     | Peer floor | Tested in this repo |
| --------------------------- | ---------- | ------------------- |
| `react` / `react-dom`       | ≥ 18       | 19.2                |
| `react-map-gl`              | ≥ 8        | 8.1                 |
| `mapbox-gl`                 | ≥ 3        | 3.29                |
| `maplibre-gl`               | ≥ 4        | 5.24                |
| `@vis.gl/react-google-maps` | ≥ 1        | 1.10                |
| `leaflet`                   | ≥ 1.9      | 1.9.4               |
| `react-leaflet`             | ≥ 4        | 5.0                 |
| `@arcgis/core`              | ≥ 4.28     | peer only           |

React 18 and react-leaflet 4 stay in range. ArcGIS is an optional peer and is
not installed in the default CI graph.

## Contributing

- [Contributing guide](./CONTRIBUTING.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Changelog](./CHANGELOG.md) · [Releases](https://github.com/orange-groove/react-map-annotate/releases)
- [Bug report](https://github.com/orange-groove/react-map-annotate/issues/new?template=bug.yml) ·
  [Feature request](https://github.com/orange-groove/react-map-annotate/issues/new?template=feature.yml)

## License

MIT. Works with [react-map-gl](https://visgl.github.io/react-map-gl/) on Mapbox
and MapLibre, [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/)
on Google Maps, [react-leaflet](https://react-leaflet.js.org/) on Leaflet, and
[ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/).
