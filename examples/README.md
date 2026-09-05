# Examples

Copy these into an app. They are not a runnable project — the [testbed](https://github.com/orange-groove/react-map-annotate-testbed) is. Each file is a complete React component.

The point of this library is that the map only paints. Tools, finish, labels, colors, and persistence are your React state. These samples show that split.

| File                                             | What it shows                                     |
| ------------------------------------------------ | ------------------------------------------------- |
| [`controlled-state.tsx`](./controlled-state.tsx) | `annotations` / `onChange` — you own the data     |
| [`custom-toolbar.tsx`](./custom-toolbar.tsx)     | `useAnnotateTools()` — your buttons, same session |
| [`custom-list.tsx`](./custom-list.tsx)           | `useAnnotateItems()` — your sidebar               |
| [`headless.tsx`](./headless.tsx)                 | `useAnnotate()` — no stock chrome at all          |
| [`mapbox.tsx`](./mapbox.tsx)                     | Mapbox + stock toolbar and list                   |
| [`maplibre.tsx`](./maplibre.tsx)                 | Same session on MapLibre                          |
| [`google.tsx`](./google.tsx)                     | Same session on Google Maps                       |
| [`leaflet.tsx`](./leaflet.tsx)                   | Same session on Leaflet                           |
| [`arcgis.tsx`](./arcgis.tsx)                     | Same session on ArcGIS                            |

Import `Annotate` from the entry that matches the map you render (`/mapbox`, `/maplibre`, `/google`, `/leaflet`, `/arcgis`). The root import is Mapbox.
