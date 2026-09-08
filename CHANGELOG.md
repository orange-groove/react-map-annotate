# Changelog

Release notes also appear on
[GitHub Releases](https://github.com/orange-groove/react-map-annotate/releases).

## 0.3.7

- Select tool with a marquee; Shift-drag adds to the selection. Click Select
  again, Finish, Enter, or Escape to return to pan so the map can move.
- Multi-select, group / ungroup (⌘G / ⇧⌘G), and copy / paste of several
  annotations at once.
- Clicking a marker pin selects it, not only the label.

## 0.3.6

- Stock toolbar and list icons use Lucide. Trace is Waypoints; the
  bidirectional arrow is MoveDiagonal.
- Finish / Enter on Trace no longer saves the hover preview. Click to keep a
  feature; Finish just leaves the tool.

## 0.3.5

- Host `trace` callbacks may be async, so Google, Leaflet, and ArcGIS can
  fetch geometry and still highlight on the same hover.
- ArcGIS pointer positions are converted from Web Mercator to lng/lat.
- README: how to enable Trace on those engines, and why Mapbox and MapLibre
  do not need a callback.

## 0.3.4

- Google Trace hover is immediate and works on the first visit. Overlay
  attach waits until the map is idle, and pointermove drives recognition.

## 0.3.3

- Trace tool: hover a rendered road or building outline, click to keep it.
  Mapbox and MapLibre query the map; other engines need a `trace` callback.
  Finished traces move by their bounds box, with no vertex handles.
- Optional `showLabels` / `showArea` on the provider and `Annotate`.

## 0.3.2

- Copy, paste, and duplicate: context menu, ⌘/Ctrl+C, V, and D.
- Area shapes are outline-only until hover.
- Shape labels sit on the visual center.
- Grab / grabbing cursor while moving an annotation.

## 0.3.1

- Package homepage is the [live demo](https://react-map-annotate-demo.onrender.com/).

## 0.3.0

Headless session work that was awkward to publish on top of 0.2.0.

- Text annotations: click to place, drag, corner resize, color, fonts.
- `AnnotateProvider` `fonts` / `defaultFontFamily`, `useAnnotateFonts()`,
  `TEXT_FONTS`.
- Arrow size from `style.strokeWidth` (shaft and heads).
- Undo / redo in the session, stock toolbar, and ⌘Z / ⇧⌘Z.
- Vertex insert and delete on polygons and paths.
- `renderLabel` on `Annotate`, same pattern as `renderArrowHead`.
- Stock list selection (`isSelected`, `select()`, `selectedId` / `onSelect`).
- Enter and Escape both finish the current draft.
- CSS and data-attribute prefix is `rma`.

## 0.2.0

Initial public package: Mapbox, MapLibre, Google, Leaflet, and ArcGIS adapters,
controlled `Annotation[]`, stock toolbar and list, geodesic measure.
