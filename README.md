# @orange-groove/react-map-annotate

Draw on Mapbox, MapLibre, Google, Leaflet, or ArcGIS. The map only paints. **You**
call `setTool` and `finish` from your own buttons, and persist the `Annotation[]`
`onCommit` hands you like any other React state.

[npm](https://www.npmjs.com/package/@orange-groove/react-map-annotate)
[demo](https://react-map-annotate-demo.onrender.com/)
[CI](https://github.com/orange-groove/react-map-annotate/actions/workflows/ci.yml)
[license](./LICENSE)

[Live demo](https://react-map-annotate-demo.onrender.com/) — Mapbox, MapLibre, Google, Leaflet, and ArcGIS.

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
samples: [examples/](./examples).

## Compare

[Terra Draw](https://github.com/JamesLMilner/terra-draw) is a capable
adapter-based drawing engine. You can drive it from your own UI (`setMode`,
`addFeatures`) and read GeoJSON from its store. Use it when you want that
control without a React session, or when you need OpenLayers.

This library is for when the drawing session itself is React state: the same
`Annotation[]` your toolbar, list, and database already speak.

|                       | This library                                                                 | Terra Draw                                                                                             | Mapbox GL Draw                                                | Leaflet.Draw                        | Google Drawing Manager                      |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| React state ownership | `Annotation[]` on the provider. `onCommit` is the write path.                | Internal GeoJSON store. Snapshot it (`getSnapshot`) and subscribe to change events to sync into React. | Draw's feature store (`getAll` / `set`). Sync out via events. | Layers on the map.                  | Overlay objects on the map.                 |
| Custom UI APIs        | Headless hooks: `useAnnotate()`, `useAnnotateTools()`, `useAnnotateItems()`. | Imperative instance API. Fully controllable; no React hooks.                                           | `changeMode`; hide or restyle the default control.            | Custom `L.Control`, or hide theirs. | `drawingControl: false` + `setDrawingMode`. |
| Supported engines     | Mapbox, MapLibre, Google, Leaflet, ArcGIS                                    | Mapbox, MapLibre, Google, Leaflet, OpenLayers                                                          | Mapbox (MapLibre via community ports)                         | Leaflet                             | Google Maps                                 |
| Built-in editing      | Move, vertex drag, rotate, mid-edge insert, vertex delete, undo / redo       | Select mode (drag, scale, rotate) plus undo / redo                                                     | `simple_select` / `direct_select`                             | Edit / delete handlers              | Limited after the shape is placed           |
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
see [examples/custom-toolbar.tsx](./examples/custom-toolbar.tsx). For a
sidebar that names, recolors, and deletes rows, see
[examples/custom-list.tsx](./examples/custom-list.tsx).

### Click twice, or press and drag

Circles, rectangles, lines, arrows, and measures all take two points. `drawMode`
decides how you give them:

```tsx
<AnnotateProvider drawMode="drag">
```

| `drawMode`          | The gesture                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `"click"` (default) | Click the first point, move, click again to finish.              |
| `"drag"`            | Press at the first point, drag, release at the second to finish. |

Two clicks are the default because they survive a shaky hand, a trackpad, and a
touch screen, and because the shape follows the cursor between the clicks so you
can see what you are about to commit. Pick `"drag"` when your users come from a
desktop drawing tool and expect to hold the button down.

The gesture is all that changes. The same `Annotation[]` comes out either way,
and the tools that only have one honest gesture keep it: freehand is always a
drag, polygon is always a click per vertex, and marker, text, and trace are
always a single click.

`drawMode` also takes a per-map override on `Annotate`, for a session that
drives two maps:

```tsx
<Annotate drawMode="drag" />
```

### A drag does not go through your state

Dragging a shape does not call `onChange`, and does not update
`useAnnotate().annotations`. The library paints the in-flight geometry itself,
at most once per frame, and hands you the result once the gesture ends. A
toolbar or a layers list reading `annotations` is a frame or two stale mid-drag
and correct as soon as the pointer comes up. Nothing you write in `onChange`
can make a drag stutter.

`onChange` fires when a change lands: the end of a gesture, and every discrete
change (add, delete, style, label, group, undo, redo). `onCommit` fires for the
same set and is the one to persist from.

```tsx
<AnnotateProvider
  annotations={annotations}
  onChange={setAnnotations}
  onCommit={(next, meta) => {
    void fetch("/api/annotations", {
      method: "PATCH",
      body: JSON.stringify({ annotations: next, changed: meta.ids }),
    });
  }}
>
```

Both callbacks receive `(annotations, meta)`. `meta.reason` is `"live"` or
`"commit"`, `meta.cause` names the change (`add`, `edit`, `style`, `label`,
`delete`, `group`, `ungroup`, `undo`, `redo`, `set`), and `meta.ids` lists the
annotations it touched. `useAnnotate()` also exposes `isEditing` if your own UI
needs to know a gesture is in flight.

If you do want the in-flight geometry, ask for it explicitly rather than paying
for it everywhere:

```tsx
import { useLiveAnnotations } from "@orange-groove/react-map-annotate/core";

// Re-renders once per frame during a drag, and only this component.
const live = useLiveAnnotations(useAnnotate().annotations);
```

`emitLiveChanges` on `AnnotateProvider` brings back a live `onChange`, throttled
to one call per frame with `meta.reason === "live"`. It costs you a render per
frame for geometry you will be handed again on commit, so leave it off unless
something outside the map has to follow the pointer.

In controlled mode the provider ignores incoming `annotations` while a gesture
is running, and treats an array you hand straight back as your echo rather than
new truth. Remapping colors or adding your own fields on the way through no
longer resets undo or fights the drag.

You do not have to hand the same array back. If you keep annotations in your own
shape and remap on the way in — through GeoJSON, a store, a fetch — every render
gives the provider a new array, so it cannot recognise your echo by reference.
It falls back to what it just committed, and to the list that commit replaced. A
prop carrying either one is a render your store has not caught up with, and is
dropped. That covers a move whose new position has not landed yet, and an add or
a delete your store applies a turn later. This is the whole host:

```tsx
<AnnotateProvider
  annotations={toLibAnnotations(annotations)}
  onCommit={(next) => setAnnotations((current) => merge(next, current))}
/>
```

Nothing else is required: no `onChange`, no `onUpdate`, no `flushSync`. Every
change lands in `onCommit` exactly once — the end of a drag, add, delete, style,
label, group, ungroup, undo, redo — and a gesture that moved nothing does not
commit at all, so a click on a shape will not mark your project dirty.

Anything that is neither the commit nor what it replaced is real news and
applies: a project load, a collaborator, an edit you made yourself. Order does
not count as a difference, so a merge is free to reorder. Once your array agrees
with the last commit the library steps back and your geometry is authoritative
again. To move existing geometry from outside the map without waiting for that,
call `setAnnotations` from `useAnnotate()` instead of routing it through the
prop.

### Persist annotations to a database

Persist from `onCommit`. It fires once per landed change — the end of a drag,
add, move, resize, label, color, delete, group, ungroup, undo, redo — and never
mid-gesture, so a save is one request per change rather than one per frame. A
gesture that moved nothing does not commit at all. Put `Annotation[]` in the
request body and load the same array back into `annotations`.

```tsx
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
```

`onChange` is the session write path: keep your React state in step with it.
`onCommit` is the persistence path. If your state is the annotations array
itself, use both as above; if you keep annotations in your own shape and remap
on the way in, drop `onChange` and set state from `onCommit` alone — see
[A drag does not go through your state](#a-drag-does-not-go-through-your-state).

Granular `onAdd` / `onDelete` / `onLabelChange` / `onColorChange` are there
when you need an audit trail. Full file:
[examples/persist.tsx](./examples/persist.tsx).

### Use with Zustand

The provider does not care where the array lives. Pass store getters and
setters as `annotations` / `onChange`, and add `onCommit` where you persist.

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

[examples/zustand.tsx](./examples/zustand.tsx). Redux, Jotai, and
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

[examples/maplibre.tsx](./examples/maplibre.tsx). Other engines:

| Engine   | `Annotate` import                                | Example                                          |
| -------- | ------------------------------------------------ | ------------------------------------------------ |
| Mapbox   | `@orange-groove/react-map-annotate` or `/mapbox` | [examples/mapbox.tsx](./examples/mapbox.tsx)     |
| MapLibre | `/maplibre`                                      | [examples/maplibre.tsx](./examples/maplibre.tsx) |
| Google   | `/google`                                        | [examples/google.tsx](./examples/google.tsx)     |
| Leaflet  | `/leaflet`                                       | [examples/leaflet.tsx](./examples/leaflet.tsx)   |
| ArcGIS   | `/arcgis`                                        | [examples/arcgis.tsx](./examples/arcgis.tsx)     |

Session imports stay on `/core`. Engine entries still re-export the session so
existing `/mapbox` (and root) imports keep working. `/osm` is the optional
OpenStreetMap Trace reader for the raster engines; see
[Enable Trace on Google, Leaflet, and ArcGIS](#enable-trace-on-google-leaflet-and-arcgis).

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

Two clicks complete a measure, or one press-drag-release under
`drawMode="drag"`. The distance reads out at the head of the path the whole
time, so you can stretch the line to the number you want before committing it.
That live figure is geodesic from the vertices; the elevation samples are the
one part that waits for the commit, because sampling terrain per frame is what
makes a drag stutter.

The saved annotation carries `distanceMeters`, the samples when terrain is
enabled, and the same formatted string on `caption`.
[examples/measure.tsx](./examples/measure.tsx).

### Trace takes one block, not the whole road

A vector tile hands back a whole road feature, which runs for as many blocks as
its tags stay the same — trace 9th Avenue and you get every block of it. So
Trace cuts the road at its crossroads and keeps the block under the pointer.
Click the next block to extend.

The crossroads are already in the data: where two roads meet at grade they
share a node, so a vertex of this road that another road also owns is a
junction. A bridge or tunnel crosses without sharing a node and stays whole,
and a crosswalk, driveway, or alley is too small to cut at.

```tsx
// Whole feature, the way it came out of the tile.
<Annotate trace={{ splitAtJunctions: false }} />
```

`junctionToleranceMeters` (default 2) sets how close two vertices have to be to
count as one node — raise it for a source whose roads do not quite meet.

### Enable Trace on Google, Leaflet, and ArcGIS

Mapbox and MapLibre already know which road or building is under the pointer.
Their vector styles expose `queryRenderedFeatures`, so Trace is on by default:
hover highlights the rendered outline, click keeps `kind: "trace"`. You do not
pass a `trace` prop on those engines.

Google, Leaflet, and ArcGIS paint a raster basemap. There is no rendered
feature graph to query, so the library cannot guess a road. You supply one:
pass `trace` on **that engine's** `<Annotate />`. The library fires hover and
click with `lngLat` (and the screen point) and paints whatever `{ coordinates }`
you return. The callback may be async.

Do **not** put this on `AnnotateProvider` if you also mount Mapbox or MapLibre
in the same session — that replaces their built-in query.

`/osm` ships a ready-made one so those engines behave like the vector engines,
blocks and all. It is a separate entry point: import it and nothing else in the
package grows, and no request is made unless you pass the callback.

```tsx
import { Annotate } from "@orange-groove/react-map-annotate/leaflet";
import { createOsmTrace } from "@orange-groove/react-map-annotate/osm";

// Module scope, not per render — it keeps what it has already read.
const trace = createOsmTrace();

<MapContainer center={[40.7484, -73.9857]} zoom={16}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  <Annotate trace={trace} />
</MapContainer>;
```

It reads the viewport off the map on the first hover, keeps the ways, and cuts
them into blocks at their shared nodes — the same rule the vector engines use,
but with real OSM node ids, so the cuts are exact rather than matched by
position. There is nothing to prefetch and no `useEffect` to wire.

Three things to know before you ship it. OSM data is ODbL, so credit
OpenStreetMap wherever the annotations are shown. The defaults are shared
community endpoints — Overpass, then the OSM map API — which are rate limited
and go down; point it at your own service for real traffic. And the payload is
worth a thought: Overpass is asked for roads (and buildings) alone, but the map
API fallback cannot filter, so the same request comes back tens of megabytes in
a dense city. `buildings: false` cuts it a long way if you only trace roads.

```tsx
const trace = createOsmTrace({
  loadWays: async (bbox, signal) => myRoadsApi(bbox, signal), // your service
  overpassEndpoints: [], // or keep the fallback, pointed at your instance
  hitMeters: 36,
  buildings: false,
  splitAtJunctions: false, // whole ways, the old behaviour
});
```

`loadWays` returns `OsmWay[]` — `{ id, coordinates, nodes, tags }`, where
`nodes` is one key per coordinate. Any two ways that use the same key are
treated as meeting there, so if your source has no node ids, pass the
coordinate and the split still works.

Or write the whole callback yourself: hit-test a GeoJSON layer, call an
internal roads API, whatever you have. `splitPathAtJunctions(path, others)` is
exported from the root for that case, so you can reuse the block split over any
set of lines.

Google's tiles are not OSM. If you pick from OSM on Google, the highlight can
disagree with the basemap. Leaflet or ArcGIS on OSM tiles will match more
closely.

`trace={false}` turns Trace off on every engine, including Mapbox and MapLibre.

## Host fields on an annotation

`data` is a passthrough bag the library never reads, and `visible: false` hides
an annotation from paint and hit-testing without removing it from the array. Use
them instead of keeping a parallel list and merging it back on every change.

```tsx
const next: Annotation = {
  ...annotation,
  visible: false,
  data: { layerId, sortOrder, featureId },
};
```

`data` is cloned with `structuredClone` for undo, so it must hold plain JSON —
no functions, class instances, or store handles.

`label` is yours and the library never overwrites it. Derived text lives on
`caption`: a measure writes its distance there and repaints it on every edit,
so a sidebar can show "Measurement 3" while the map shows `1.2 km`.

## Styling strokes and fills

| Field              | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `color`            | Stroke and fill color.                                  |
| `strokeWidth`      | Line width, and area outline width.                     |
| `strokeOpacity`    | Stroke alpha. Defaults to 0.95.                         |
| `fillOpacity`      | Resting fill alpha for areas. Defaults to 0.            |
| `hoverFillOpacity` | Fill alpha on hover. Defaults to `fillOpacity` or 0.18. |

Keep `color` to `#RRGGBB` or a CSS color. Mapbox and MapLibre read the color
from a data property, and 8-digit `#RRGGBBAA` is not valid there — the shaft
falls back to black while SVG arrow heads still honor it. Put the alpha in
`strokeOpacity` or `fillOpacity` instead.

## Mounting alongside your own layers

`Annotate` waits for the map style to load before adding its sources, so
`enableTerrain` restyles no longer drop the annotation layers. `onStyleReady`
fires once they are mounted.

When your app selects its own layers on the same map, ask whether a click was
already ours:

```tsx
import { annotateClickTarget } from "@orange-groove/react-map-annotate/core";

map.on("click", (event) => {
  const { consumed, id } = annotateClickTarget(
    map.queryRenderedFeatures(event.point),
  );
  if (consumed) return; // the annotation session handled it
  selectProjectFeature(event);
});
```

`isAnnotateLayerId(layerId)` is the lower-level check if you need it.

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

- **Select** — click an annotation to select it. Shift-click or ⌘/Ctrl-click
  adds or removes. Drag an empty area to draw a dotted box; everything inside
  is selected. Hold Shift while dragging the box to add to the selection.
- **Trace** — hover a road or building outline to highlight it. Click to
  keep that feature. Roads arrive one block at a time, cut at their crossroads;
  click the next block to extend. Move the finished shape by its bounds box; it
  has no vertex handles.
- **Circle, rectangle, line, arrow, bidirectional arrow, measure** — click to
  place the first point, click again to finish. Set `drawMode="drag"` to take
  the whole shape from one press-drag-release instead.
- **Freehand** — sketch with the button held; completes on mouse up.
- **Measure** — the distance so far reads out at the head of the path from the
  first point on, not only once the shape is finished.
- **Polygon** — click vertices, then Finish.
- **Marker** — click to drop a pin.
- **Text** — click to place. Type to edit. Corner handle resizes. Rotate
  handle turns it. Color from the list.
- **Edit** — hover or select a finished shape to move it, or drag it by its
  label. End handles resize
  lines, arrows, and measures. Vertices resize polygons and rectangles. A
  diagonal handle resizes circles. A rotate handle turns drawings, rectangles,
  polygons, and text around their center. Hollow mid-edge handles insert vertices on
  polygons and paths. Double-click a vertex (or select it and press Delete) to
  remove it. Click empty map to deselect. Shift-click or ⌘/Ctrl-click to select more than one annotation.
  With the Select tool, drag a dotted rectangle to select everything inside
  (Shift-drag adds to the selection). Click Select again, or press Finish /
  Enter / Escape, to return to pan so the map can move. Selecting one member of a group selects
  the rest. Hover a grouped annotation to see a dotted box around the group.
  Drag a selected shape, or its label, to move the whole selection. Vertex
  handles stay hidden while more than one item is selected.
  ⌘G / Ctrl+G groups the selection; ⇧⌘G / Ctrl+Shift+G ungroups it. Undo /
  redo from the toolbar or ⌘Z / ⇧⌘Z. Right-click opens Duplicate, Copy, Paste,
  Group, Ungroup, and Delete. ⌘D / Ctrl+D duplicates the selection to the
  right. ⌘C / Ctrl+C copies the selected set; ⌘V / Ctrl+V pastes it at the
  pointer, keeping relative spacing and group membership.

```tsx
<Annotate
  enableTerrain
  defaultColor="#2563eb"
  defaultStrokeWidth={3}
  drawMode="click"
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

| Tool                  | What it does                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select                | Click to select. Shift/⌘-click for more than one. Drag a dotted box to select several at once.                                                            |
| Freehand              | Sketch a path. Hover for a bounds box; drag to move. Corner handle resizes; rotate handle turns it.                                                       |
| Trace                 | Hover a rendered road or building outline, click to adopt it. No freehand, no per-vertex handles.                                                         |
| Line                  | Two points. Hover ends to resize.                                                                                                                         |
| Arrow / bidirectional | Line plus SVG heads. Size from the list, or `setStyle({ strokeWidth })` — widens the shaft and the heads.                                                 |
| Circle                | Center, then radius. Hover for a resize handle.                                                                                                           |
| Rectangle             | Two opposite corners. Hover vertices to resize, rotate handle to turn.                                                                                    |
| Polygon               | Click vertices, Finish to close. Rotate handle turns it.                                                                                                  |
| Measure               | Geodesic length, live while you draw, optional terrain samples.                                                                                           |
| Marker                | Labeled map pin. Drag the pin to move it.                                                                                                                 |
| Text                  | Click to place. Drag to move, corner to resize, rotate handle to turn. Color and font from the list, or `setStyle({ fontFamily })`. Double-click to edit. |
| Finish                | Commit the draft (same as Enter).                                                                                                                         |

Mapbox and MapLibre query rendered road and building layers — no `trace` prop.
Google, Leaflet, and ArcGIS need a `trace` callback; see
[Enable Trace on Google, Leaflet, and ArcGIS](#enable-trace-on-google-leaflet-and-arcgis).
`trace={false}` turns it off.

## API snapshot

| Export                 | Role                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| `/core`                | Session, hooks, types, utils, toolbar, list — no `Annotate`.                      |
| `AnnotateProvider`     | Session. Optional `annotations` / `onChange` / `onCommit` / `drawMode` / `fonts`. |
| `Annotate`             | Map child. Drawing, hover handles, layers.                                        |
| `AnnotateToolbar`      | Stock icon toolbar — optional.                                                    |
| `AnnotateList`         | Stock label / color / font / size / delete list — optional.                       |
| `useAnnotate()`        | Full session: `setTool`, `setLabel`, `setStyle`, `fonts`, …                       |
| `useAnnotateTools()`   | `{ items, finish, canFinish, deleteSelected, undo, redo }`                        |
| `useAnnotateItems()`   | Rows with `isSelected`, `select`, `setLabel`, `setColor`, `setStyle`, `remove`.   |
| `useAnnotateFonts()`   | Font catalog from the provider.                                                   |
| `useLiveAnnotations()` | In-flight geometry during a gesture, one render per frame.                        |
| `AnnotateToolIcon`     | Bundled tool SVG.                                                                 |

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
