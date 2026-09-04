# @orange-groove/react-map-gl-annotate

**Draw on a Mapbox map in React — then own the data.**

A drawing manager for [react-map-gl](https://visgl.github.io/react-map-gl/) v8. Drop `<Annotate />` on the map, put a toolbar anywhere else, and keep every annotation in your own React state. No `mapRef`. No hidden store you cannot see. No Mapbox Draw CSS fight.

[![npm](https://img.shields.io/npm/v/@orange-groove/react-map-gl-annotate)](https://www.npmjs.com/package/@orange-groove/react-map-gl-annotate)
[![license](https://img.shields.io/npm/l/@orange-groove/react-map-gl-annotate)](./LICENSE)
[![react-map-gl](https://img.shields.io/badge/react--map--gl-v8-blue)](https://visgl.github.io/react-map-gl/)

```bash
npm install @orange-groove/react-map-gl-annotate
```

```tsx
import Map from "react-map-gl/mapbox";
import {
  Annotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-gl-annotate";
import "@orange-groove/react-map-gl-annotate/styles.css";

<AnnotateProvider>
  <Map mapboxAccessToken={token} /* ... */>
    <Annotate />
  </Map>
  <AnnotateToolbar />
  <AnnotateList />
</AnnotateProvider>;
```

That is a working drawing app: freehand, lines, arrows, shapes, geodesic measure, and labeled markers. The list on the side edits labels and colors. Finish commits the shape. Your UI can replace the stock chrome whenever you want.

## Why this exists

Mapbox Draw is built for the Mapbox GL imperative API. `react-map-gl` v8 already gives you `Source`, `Layer`, `Marker`, and `useMap()`. This library stays in that world.

| You need | What you get |
| --- | --- |
| Draw on a React map | `<Annotate />` is a Map child. It calls `useMap()` itself. |
| A toolbar that is not trapped in the canvas | Provider session. Stock toolbar, or `useAnnotateTools()`. |
| Annotations you can persist | `Annotation[]` in your state. `onChange`, or Zustand / Redux. |
| Labels and colors from a sidebar | `<AnnotateList />` or `useAnnotateItems()`. |
| Real distances | Haversine paths, 10 m geodesic samples, optional terrain elevation. |
| Your design system | Headless hooks. Bring buttons, icons, or none. |

Ship field markup, site plans, patrol routes, or a “measure this fence” tool without wrapping `MapboxDraw` in refs and custom modes.

## Features

- **Freehand, line, arrow, bidirectional arrow** — arrow heads are SVG `Marker`s. Swap the default head.
- **Circle, rectangle, polygon** — hover to move. Drag vertices to reshape. Circle gets a diagonal resize handle.
- **Measure** — ground distance with haversine interpolation every 10 m. Turn on terrain and each sample records `queryTerrainElevation`.
- **Labeled markers** — real react-map-gl pins, not a fake button.
- **Finish, not a pointer tool** — draw, press Finish (or Enter). Escape cancels. Hover reveals edit handles.
- **Your state** — controlled `annotations` + `onChange`, or let the provider hold them.
- **Your chrome** — `useAnnotateTools()` and `useAnnotateItems()` for a custom toolbar or list.

## Install

```bash
npm install @orange-groove/react-map-gl-annotate
```

Peers: `react` and `react-dom` ≥ 18, `react-map-gl` ≥ 8, `mapbox-gl` ≥ 3.

```ts
import "@orange-groove/react-map-gl-annotate/styles.css";
```

Import the CSS once. Skip it if you style everything yourself.

## Quick start

Uncontrolled — the provider owns the list:

```tsx
import Map from "react-map-gl/mapbox";
import {
  Annotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-gl-annotate";
import "@orange-groove/react-map-gl-annotate/styles.css";

export function MapWithDraw({ token }: { token: string }) {
  return (
    <AnnotateProvider>
      <Map
        mapboxAccessToken={token}
        initialViewState={{ longitude: -73.9857, latitude: 40.7484, zoom: 14 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
      >
        <Annotate />
      </Map>
      <AnnotateToolbar />
      <AnnotateList />
    </AnnotateProvider>
  );
}
```

`Annotate` must be a child of `Map`. `AnnotateToolbar` and `AnnotateList` can live anywhere under `AnnotateProvider` — overlay, sidebar, modal.

## Keep the data

This is the path you want in production. The map draws. You persist.

```tsx
import { useState } from "react";
import type { Annotation } from "@orange-groove/react-map-gl-annotate";

const [annotations, setAnnotations] = useState<Annotation[]>([]);

<AnnotateProvider annotations={annotations} onChange={setAnnotations}>
  <Map /* ... */>
    <Annotate enableTerrain />
  </Map>
  <AnnotateToolbar />
  <AnnotateList />
</AnnotateProvider>;
```

`onChange` fires on add, move, resize, label, color, and delete. Save it to a server, a Zustand store, or `localStorage`.

Granular callbacks when you need an audit trail:

```tsx
<AnnotateProvider
  annotations={annotations}
  onChange={setAnnotations}
  onAdd={(annotation) => analytics.track("annotation_added", annotation.kind)}
  onDelete={(id) => api.annotations.remove(id)}
  onLabelChange={(id, label) => api.annotations.patch(id, { label })}
  onColorChange={(id, color) => api.annotations.patch(id, { color })}
>
```

## Stock toolbar

Icon toolbar, ready to drop in:

```tsx
<AnnotateToolbar />
<AnnotateToolbar orientation="horizontal" />
<AnnotateToolbar tools={["polygon", "circle", "measure", "marker"]} />
```

## Custom toolbar

Same session, your buttons. Text, icons, or both:

```tsx
import {
  AnnotateToolIcon,
  useAnnotateTools,
} from "@orange-groove/react-map-gl-annotate";

function TextToolbar() {
  const { items, finish, canFinish, selectedId, deleteSelected } =
    useAnnotateTools();

  return (
    <div role="toolbar" aria-label="Annotation tools">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.active}
          onClick={item.select}
        >
          {item.label}
        </button>
      ))}
      <button type="button" disabled={!canFinish} onClick={finish}>
        Finish
      </button>
      <button type="button" disabled={!selectedId} onClick={deleteSelected}>
        Delete
      </button>
    </div>
  );
}
```

A subset, with the bundled icons:

```tsx
const { items } = useAnnotateTools(["line", "polygon", "measure"]);

{
  items.map((item) => (
    <button key={item.id} aria-pressed={item.active} onClick={item.select}>
      <AnnotateToolIcon tool={item.id} />
      {item.label}
    </button>
  ));
}
```

Or call the session when you already have a design-system `Button`:

```tsx
import { useAnnotate } from "@orange-groove/react-map-gl-annotate";

function PolygonTool() {
  const { tool, setTool, finish, canFinish } = useAnnotate();
  return (
    <>
      <button
        aria-pressed={tool === "polygon"}
        onClick={() => setTool("polygon")}
      >
        Polygon
      </button>
      <button disabled={!canFinish} onClick={finish}>
        Finish
      </button>
    </>
  );
}
```

## Stock list

A sidebar that lists every annotation: color picker, label, delete.

```tsx
<AnnotateList />
<AnnotateList emptyMessage="Draw something to start" />
```

You can also pass the data in and skip the provider session:

```tsx
<AnnotateList
  annotations={annotations}
  onLabelChange={(id, label) => {
    setAnnotations((current) =>
      current.map((item) => (item.id === id ? { ...item, label } : item)),
    );
  }}
  onColorChange={(id, color) => {
    setAnnotations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, style: { ...item.style, color } } : item,
      ),
    );
  }}
  onDelete={(id) => {
    setAnnotations((current) => current.filter((item) => item.id !== id));
  }}
/>
```

## Custom list

```tsx
import { useAnnotateItems } from "@orange-groove/react-map-gl-annotate";

function AnnotationSidebar() {
  const items = useAnnotateItems();

  if (items.length === 0) return <p>No annotations</p>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.kindLabel}</span>
          <input
            value={item.label}
            onChange={(event) => item.setLabel(event.target.value)}
          />
          <input
            type="color"
            value={item.color}
            onChange={(event) => item.setColor(event.target.value)}
          />
          <button type="button" onClick={item.remove}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
```

From a command palette, a form, or a keyboard shortcut:

```tsx
const { annotations, setLabel, setColor, onDelete } = useAnnotate();

setLabel(annotations[0].id, "North fence");
setColor(annotations[0].id, "#ef4444");
onDelete(annotations[0].id);
```

## How drawing feels

Pick a tool. Draw. Press **Finish** (or Enter). Escape cancels.

- **Freehand, circle, rectangle** — complete on mouse up. Finish leaves the tool.
- **Line, arrow, bidirectional arrow, measure** — complete on the second click.
- **Polygon** — click vertices, then Finish. The edge back to the first vertex is dotted.
- **Edit** — hover a finished shape to move it. Vertices resize polygons and rectangles. A diagonal handle resizes circles. Freehand drawings show a bounds box.

```tsx
<Map>
  <Annotate enableTerrain defaultColor="#2563eb" defaultStrokeWidth={3} />
</Map>
```

## Measure like you mean it

Distances are not screen pixels. Paths are densified along the geodesic every 10 meters (configurable). With terrain enabled, each sample asks Mapbox for ground height so you can show gain, loss, and min / max elevation.

```tsx
<Annotate enableTerrain sampleIntervalMeters={10} />
```

## Custom arrow heads

Default heads are SVG markers, not a line cap hack. Replace them:

```tsx
<Annotate
  renderArrowHead={({ bearing, color, size }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${bearing}deg)` }}
    >
      <path d="M12 2 L20 20 L12 16 L4 20 Z" fill={color} />
    </svg>
  )}
/>
```

## Tools

| Tool | What it does |
| --- | --- |
| Freehand | Sketch a path. Hover for a bounds box; drag to move. |
| Line | Two-click segment. |
| Arrow / bidirectional | Line plus SVG heads you can replace. |
| Circle | Drag to create. Hover for a resize handle; drag the fill to move. |
| Rectangle | Drag to create. Hover vertices to resize. |
| Polygon | Click vertices, Finish to close. Hover vertices to edit. |
| Measure | Geodesic length, optional terrain samples. |
| Marker | Labeled Mapbox pin. |
| Finish | Commit the draft (same as Enter) and leave the tool. |

## API snapshot

| Export | Role |
| --- | --- |
| `AnnotateProvider` | Session. Optional `annotations` / `onChange`. |
| `Annotate` | Map child. Drawing, hover handles, layers. |
| `AnnotateToolbar` | Stock icon toolbar. |
| `AnnotateList` | Stock label / color / delete list. |
| `useAnnotate()` | Full session: `setTool`, `setLabel`, `setColor`, `finish`, … |
| `useAnnotateTools()` | `{ items, finish, canFinish, deleteSelected }` |
| `useAnnotateItems()` | Rows with `setLabel`, `setColor`, `remove`. |
| `AnnotateToolIcon` | Bundled tool SVG. |

Types ship with the package: `Annotation`, `AnnotateTool`, `AnnotateSession`, and the rest.

## License

MIT. Built for [react-map-gl](https://visgl.github.io/react-map-gl/) on Mapbox.
