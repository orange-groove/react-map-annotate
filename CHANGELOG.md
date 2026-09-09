# Changelog

Release notes also appear on
[GitHub Releases](https://github.com/orange-groove/react-map-annotate/releases).

## 0.3.14

Live editing no longer goes through React. Dragging an annotation used to run a
full session commit per pointer event: `setState` with the whole list, a render
of the provider and every `useAnnotate()` consumer, a rebuild of every feature,
and six source uploads. Now a gesture paints from a store that sits beside
React, coalesced to one frame.

- A drag no longer calls `setState`, `onChange`, or the `onUpdate` prop per
  pointer event. Geometry lands on the map through an internal live store,
  rAF-coalesced, and reaches the session, the host, and history once on
  `endEdit`. `onCommit` still fires once at the end of the gesture.
- **Behaviour change:** `onChange` no longer fires with `reason: "live"` unless
  you set `emitLiveChanges` on `AnnotateProvider`, and even then it is throttled
  to one call per frame. Hosts that were filtering `reason === "live"` can drop
  the filter. `useAnnotate().annotations` is now deliberately stale for the span
  of a drag; read `useLiveAnnotations()` if you need the in-flight geometry.
- Feature building is incremental. An annotation whose geometry did not change
  keeps its feature, and a source whose contents did not change keeps its
  collection, so the map only re-uploads the source holding the annotation being
  dragged.
- Measure paths no longer re-sample against terrain on every frame. A drag keeps
  the distance readout live from the vertices and hides the sample dots;
  `settleMeasurement` re-samples once on commit.
- The cursor is set on pointer-down and on change, not on every pointer move.
- A programmatic `onUpdate` outside a gesture still commits immediately, and
  still folds into one undo step until `endEdit`.

## 0.3.13

A session-versus-persist pass, from integration feedback on an app that keeps
annotations in its own store and PATCHes on idle.

- `onCommit(annotations, meta)` on `AnnotateProvider` fires once when a gesture
  ends and for every discrete change. `onChange` now also receives `meta`, with
  `reason: "live" | "commit"`, a `cause`, and the `ids` touched. Existing
  single-argument `onChange` handlers keep working.
- `isEditing` on `useAnnotate()`.
- Controlled mode no longer fights the host: incoming `annotations` are ignored
  while a gesture is in flight, an array handed straight back is recognised as
  our own echo by reference, and a host remap that leaves geometry alone is
  adopted without clearing undo. Replaces the one-shot internal commit flag that
  could swallow a real update.
- `visible: false` hides an annotation from paint and hit-testing. `data` is a
  passthrough bag for host fields, cloned with the annotation for undo.
- `caption` carries library-derived text. A measure writes its distance there
  instead of overwriting `label`, which is now host-owned for good.
- Honest style fields: `strokeOpacity` (was hardcoded 0.95 across four paint
  paths), `fillOpacity` as the resting fill, and `hoverFillOpacity` for hover.
  Area outlines now honour `strokeWidth`. **Behaviour change:** `fillOpacity`
  used to apply only on hover; set `hoverFillOpacity` for the old effect.
- `Annotate` waits for the map style to load before adding sources, so an
  `enableTerrain` restyle no longer unmounts the layers. New `onStyleReady`.
- `annotateClickTarget(features)` reports `{ consumed, id }` so a host can tell
  whether a map click already belonged to the annotation session.
- Circles paint from `center` + `radiusMeters`; the ring is regenerated at paint
  time rather than trusted from a round-tripped array.

## 0.3.12

- Keep handles black instead of color of annotation.

## 0.3.11

- Rotate handle on drawings, rectangles, polygons, and text. Drawings also
  resize from a handle on the bounds box, which turns with the outline.

## 0.3.10

- Select marquee follows the pointer on Google Maps and draws on Leaflet.

## 0.3.9

- Hovering a grouped annotation draws a dotted box around pins, labels, and
  geometry, not just coordinate tips.
- Resize handles stay visible when dragging a shape inside a group.

## 0.3.8

- Clicking empty map deselects, in pan and Select.

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
