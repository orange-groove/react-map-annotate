# @orange-groove/react-map-annotate

**Draw on Mapbox, MapLibre, Google, Leaflet, or ArcGIS — and keep every tool, label, and coordinate in your React API.**

Most map drawing libraries give you a canvas control. They own the toolbar, they own the feature store, and they let you listen in. This library inverts that. The map only paints. **You** choose the tool, finish the shape, name it, recolor it, delete it, and persist `Annotation[]` like any other React state.

[![npm](https://img.shields.io/npm/v/@orange-groove/react-map-annotate)](https://www.npmjs.com/package/@orange-groove/react-map-annotate)
[![license](https://img.shields.io/npm/l/@orange-groove/react-map-annotate)](./LICENSE)

```bash
npm install @orange-groove/react-map-annotate
```

```tsx
import Map from "react-map-gl/mapbox";
import {
  Annotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-annotate";
import "@orange-groove/react-map-annotate/styles.css";

<AnnotateProvider annotations={annotations} onChange={setAnnotations}>
  <Map mapboxAccessToken={token} /* ... */>
    <Annotate />
  </Map>
  <aside>
    <AnnotateToolbar />
    <AnnotateList />
  </aside>
</AnnotateProvider>;
```

Stock chrome is a courtesy. The same session drives **your** buttons, **your** list, **your** command palette. See [`examples/`](./examples).

## Why other libraries fall short

If you have shipped a “draw a fence” tool on a real product, you have already hit this wall.

**Mapbox GL Draw** injects its own control into the map. Tools are Draw modes. Features live in Draw’s store (`draw.getAll()`, `draw.set()`). Want a toolbar in the app header? Hide theirs and reimplement modes. Want the selected polygon’s label in a React form? Subscribe to Draw events and copy data out. Want the same UX on MapLibre next year? Start over, or keep a `mapRef` forever.

**Leaflet.Draw** is a `L.Control`. **Google’s Drawing Manager** is a map overlay with `drawingControlOptions`. Both treat your UI as a visitor: restyle their DOM, scrape overlays off the map, hope the next event still fires.

**terra-draw** is closer — it is adapter-based and less chrome-heavy — but you still assemble modes, wire the adapter, and keep a store on the side. There is no React session. There is no `useAnnotateTools()`. There is no single `Annotation` you can save from Mapbox today and render on Leaflet tomorrow.

Those libraries were built to draw **on the map**. This one was built so **your app** can draw, and the map is a view.

## Why this was built

We needed field markup, site plans, and “measure that fence” in a React app that already had a design system, a sidebar, and a database.

The map engine was not the product. The product was: pick a tool from **our** toolbar, finish a shape with **our** Done button, name it in **our** list, save `Annotation[]` with everything else.

Existing drawing managers would not give us that without wrapping an imperative control in refs and leaking their UI. So this library does three things and stops:

1. **A React session** — tool, draft, selection, add / update / delete.
2. **A paint adapter** per host map — Mapbox, MapLibre, Google, Leaflet, ArcGIS.
3. **Headless hooks** — `useAnnotate()`, `useAnnotateTools()`, `useAnnotateItems()`.

The stock toolbar and list are example consumers of that API, not the API.

## What it accomplishes

| You need                                   | What you get                                                        |
| ------------------------------------------ | ------------------------------------------------------------------- |
| The toolbar in a sidebar, modal, or header | Provider session. Call `setTool`, `finish`, `onDelete`.             |
| Annotations you can persist                | `Annotation[]` in your state. `onChange`, or Zustand / Redux.       |
| Labels and colors from your UI             | `setLabel`, `setColor`, or `useAnnotateItems()`.                    |
| The same data on five maps                 | One model. `[lng, lat]`. Import `Annotate` from the matching entry. |
| Real distances                             | Haversine paths, 10 m geodesic samples, optional terrain elevation. |
| No `mapRef` drawing loop                   | `<Annotate />` is a map child. It calls `useMap()` itself.          |

Freehand, lines, arrows, bidirectional arrows, circles, rectangles, polygons, geodesic measure, and labeled markers. Hover to move. Drag handles to reshape. Finish commits. Escape cancels.

## Custom control is the API

You never have to use the bundled toolbar.

```tsx
import { useAnnotateTools } from "@orange-groove/react-map-annotate";

function TextToolbar() {
  const { items, finish, canFinish, selectedId, deleteSelected } =
    useAnnotateTools();

  return (
    <div role="toolbar">
      {items.map((item) => (
        <button key={item.id} aria-pressed={item.active} onClick={item.select}>
          {item.label}
        </button>
      ))}
      <button disabled={!canFinish} onClick={finish}>
        Finish
      </button>
      <button disabled={!selectedId} onClick={deleteSelected}>
        Delete
      </button>
    </div>
  );
}
```

Or skip the helper and drive the session from any UI you already have:

```tsx
const { tool, setTool, finish, canFinish, setLabel, setColor, onDelete } =
  useAnnotate();

setTool("polygon");
finish();
setLabel(id, "North fence");
setColor(id, "#ef4444");
onDelete(id);
```

That is the difference. Other libraries let you **listen**. This one lets you **command**.

Full samples: [`examples/custom-toolbar.tsx`](./examples/custom-toolbar.tsx), [`examples/custom-list.tsx`](./examples/custom-list.tsx), [`examples/headless.tsx`](./examples/headless.tsx).

## Install

```bash
npm install @orange-groove/react-map-annotate
```

Peers: `react` and `react-dom` ≥ 18.

| Map      | Also install                                          |
| -------- | ----------------------------------------------------- |
| Mapbox   | `react-map-gl` ≥ 8, `mapbox-gl` ≥ 3                   |
| MapLibre | `react-map-gl` ≥ 8, `maplibre-gl` ≥ 4                 |
| Google   | `@vis.gl/react-google-maps` ≥ 1                       |
| Leaflet  | `leaflet` ≥ 1.9, `react-leaflet` ≥ 4 (v5 on React 19) |
| ArcGIS   | `@arcgis/core` ≥ 4.28                                 |

```ts
import "@orange-groove/react-map-annotate/styles.css";
```

Import the CSS once. Skip it if you style everything yourself.

## Quick start

The root import is Mapbox. `Annotate` must be a child of `Map`. Toolbar and list can live anywhere under `AnnotateProvider`.

```tsx
import { useState } from "react";
import Map from "react-map-gl/mapbox";
import {
  Annotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
  type Annotation,
} from "@orange-groove/react-map-annotate";
import "@orange-groove/react-map-annotate/styles.css";

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
        <Annotate enableTerrain />
      </Map>
      <AnnotateToolbar />
      <AnnotateList />
    </AnnotateProvider>
  );
}
```

`onChange` fires on add, move, resize, label, color, and delete. Save it to a server, a store, or `localStorage`. Granular `onAdd` / `onDelete` / `onLabelChange` / `onColorChange` are there when you need an audit trail.

## One session, five maps

Import `Annotate` from the entry that matches the `Map` you render. The annotation model does not change.

| Engine   | Import                                           | Example                                            |
| -------- | ------------------------------------------------ | -------------------------------------------------- |
| Mapbox   | `@orange-groove/react-map-annotate` or `/mapbox` | [`examples/mapbox.tsx`](./examples/mapbox.tsx)     |
| MapLibre | `/maplibre`                                      | [`examples/maplibre.tsx`](./examples/maplibre.tsx) |
| Google   | `/google`                                        | [`examples/google.tsx`](./examples/google.tsx)     |
| Leaflet  | `/leaflet`                                       | [`examples/leaflet.tsx`](./examples/leaflet.tsx)   |
| ArcGIS   | `/arcgis`                                        | [`examples/arcgis.tsx`](./examples/arcgis.tsx)     |

Mapbox `enableTerrain` uses the Mapbox terrain DEM. MapLibre needs an explicit raster-DEM (`terrainSource`). Terrain is a no-op on Google, Leaflet, and ArcGIS.

Google needs a `mapId` (the public `DEMO_MAP_ID` is enough) so labels and handles can use Advanced Markers. Leaflet coordinates stay `[lng, lat]` in your state; isolate the map in a stacking context so panes do not cover your chrome. ArcGIS: pass the `MapView` through `ArcgisViewProvider` — do not mount React children inside `MapView.container`. If you render `<arcgis-map>`, put `<Annotate />` inside it.

## How drawing feels

Pick a tool. Draw. Press **Finish** (or Enter). Escape cancels.

- **Freehand, circle, rectangle** — complete on mouse up.
- **Line, arrow, bidirectional arrow, measure** — complete on the second click.
- **Polygon** — click vertices, then Finish.
- **Edit** — hover a finished shape to move it. End handles resize lines, arrows, and measures. Vertices resize polygons and rectangles. A diagonal handle resizes circles.

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
/>
```

Measure paths are densified along the geodesic every 10 meters. With terrain enabled, each sample records ground height.

## Tools

| Tool                  | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| Freehand              | Sketch a path. Hover for a bounds box; drag to move. |
| Line                  | Two-click segment. Hover ends to resize.             |
| Arrow / bidirectional | Line plus SVG heads you can replace.                 |
| Circle                | Drag to create. Hover for a resize handle.           |
| Rectangle             | Drag to create. Hover vertices to resize.            |
| Polygon               | Click vertices, Finish to close.                     |
| Measure               | Geodesic length, optional terrain samples.           |
| Marker                | Labeled map pin. Drag the pin to move it.            |
| Finish                | Commit the draft (same as Enter).                    |

## API snapshot

| Export               | Role                                                         |
| -------------------- | ------------------------------------------------------------ |
| `AnnotateProvider`   | Session. Optional `annotations` / `onChange`.                |
| `Annotate`           | Map child. Drawing, hover handles, layers.                   |
| `AnnotateToolbar`    | Stock icon toolbar — optional.                               |
| `AnnotateList`       | Stock label / color / delete list — optional.                |
| `useAnnotate()`      | Full session: `setTool`, `setLabel`, `setColor`, `finish`, … |
| `useAnnotateTools()` | `{ items, finish, canFinish, deleteSelected }`               |
| `useAnnotateItems()` | Rows with `setLabel`, `setColor`, `remove`.                  |
| `AnnotateToolIcon`   | Bundled tool SVG.                                            |

Types ship with the package: `Annotation`, `AnnotateTool`, `AnnotateSession`, and the rest.

## License

MIT. Works with [react-map-gl](https://visgl.github.io/react-map-gl/) on Mapbox and MapLibre, [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/) on Google Maps, [react-leaflet](https://react-leaflet.js.org/) on Leaflet, and [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/).
