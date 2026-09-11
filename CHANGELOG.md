# Changelog

Release notes also appear on
[GitHub Releases](https://github.com/orange-groove/react-map-annotate/releases).

## 0.3.21

- Trace cuts a road at its crossroads and keeps the block under the pointer. A
  vector tile hands back a whole road feature, so tracing 9th Avenue used to
  paint every block it runs through. Crossroads come from the shared nodes
  already in the data, which keeps a bridge or tunnel whole and does not cut at
  a crosswalk, driveway, or alley. Click the next block to extend.
- `trace={{ splitAtJunctions: false }}` keeps the old whole-feature behaviour,
  and `junctionToleranceMeters` sets how close two vertices must be to count as
  one junction node.
- New `/osm` entry point: `createOsmTrace()` is a ready-made `trace` callback
  for Google, Leaflet, and ArcGIS, which have no vector query of their own. It
  reads the viewport off the map, keeps what it has read, and returns the road
  block or building outline under the pointer — so those engines now behave
  like Mapbox and MapLibre rather than painting a whole way. Nothing is
  imported or requested unless you pass the callback.
- `loadWays` on `createOsmTrace` swaps the data source for your own service.
  The defaults are Overpass and then the OSM map API, which are rate limited
  and cannot be relied on for production traffic. OSM data is ODbL, so credit
  OpenStreetMap where the annotations are shown.
- `splitPathAtJunctions` is exported from the root for hosts writing their own
  `trace` callback over some other set of lines.

## 0.3.20

- `drawMode` on `AnnotateProvider` and `Annotate` picks the create gesture for
  the two-point shapes — circle, rectangle, line, arrow, bidirectional arrow,
  and measure. `"click"` places the first point on one click and finishes on the
  second; `"drag"` takes the whole shape from one press-drag-release.
- **Behaviour change:** `drawMode` defaults to `"click"`, so circles and
  rectangles are now drawn with two clicks rather than a drag. Pass
  `drawMode="drag"` to keep the old gesture. Lines, arrows, and measures are
  unchanged by the default.
- Freehand, polygon, marker, text, and trace are untouched by `drawMode`: each
  has only one honest gesture, and keeps it.
- A measure shows its length while it is being drawn, at the head of the path,
  from the first point rather than only once it is finished. The live figure is
  geodesic from the vertices, so it costs nothing per frame and reads the same
  as the `caption` that replaces it on commit. Terrain sampling still waits for
  the commit.
- `isDragTool` and `isClickVertexTool` take an optional `drawMode` as their
  second argument. Called with one argument they answer for the default mode,
  which means `isDragTool("circle")` is now `false`.

## 0.3.19

Update README.md

## 0.3.18

- The rotate handle no longer sits on the corner handle. It was placed 22px
  past the top-right corner while every handle grabs within 20px of itself, so
  on a rectangle it covered the corner you resize from. It now clears the
  corner by a whole hit box.

## 0.3.17

Remapping hosts persist with `onCommit` only. Keeping annotations in your own
shape — GeoJSON, a store, a fetch — means every render hands the provider a new
array, and a store that lands a turn later hands it a stale one. Neither loses a
change now.

- A gesture always tells the host what it did. `endEdit` used to commit only
  what it could drain from the live store, so a move whose geometry reached the
  session by any other route ended silently and never reached `onCommit`. It now
  commits whenever the list differs from what the host was last told.
- The reverse, too: a gesture that changed nothing no longer commits. Pressing a
  marker, a handle, or a label and letting go without moving it used to fire
  `onCommit`, which for a host that persists from `onCommit` meant a save on
  every click.
- A stale `annotations` prop no longer clobbers an add or a delete. The provider
  already held its last commit against a host whose store had not caught up; it
  now also holds the list that commit replaced, so a render still carrying the
  pre-commit id set is recognised as behind rather than taken for a load.
- Order is no longer geometry. A host merge that hands the same shapes back in a
  different order counts as being in step, so the provider stops holding the
  line and undo history survives.

## 0.3.16

- Labels drag their annotation. A label was a caption you could only click,
  even though it has always been styled with a grab cursor; grabbing one now
  moves the shape it names, including every other selected annotation. Custom
  labels from `renderLabel` drag too.
- A label only becomes a drag once the pointer has travelled a few pixels, so
  click-to-select and double-click-to-rename are untouched.

## 0.3.15

- Controlled mode no longer needs the host to echo the same array back. A host
  that remaps annotations on the way in produces a new array every render, so
  reference identity cannot tell a stale render apart from real news: the
  provider now also holds the geometry of its last commit, and drops an incoming
  `annotations` prop that disagrees with it while the id set is unchanged. Fixes
  a drag snapping back for a host that persists from `onCommit` alone and keeps
  annotations in its own shape. A changed id set is a load and always applies,
  and the library steps back as soon as the host's array agrees with the commit.

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
