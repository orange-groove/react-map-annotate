# Changelog

Release notes also appear on
[GitHub Releases](https://github.com/orange-groove/react-map-annotate/releases).

## 0.3.1

- Copy, paste, and duplicate: context menu, ⌘/Ctrl+C, V, and D.
- Area shapes are outline-only until hover.
- Shape labels sit on the visual center.
- Grab / grabbing cursor while moving an annotation.
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
