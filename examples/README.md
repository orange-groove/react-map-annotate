# Examples

Copy these into an app. They are not a runnable project. Each file is a React
component.

| File                                             | What it shows                                     |
| ------------------------------------------------ | ------------------------------------------------- |
| [`headless.tsx`](./headless.tsx)                 | `setTool` / `finish` — no stock chrome            |
| [`custom-toolbar.tsx`](./custom-toolbar.tsx)     | `useAnnotateTools()` — your buttons, same session |
| [`custom-list.tsx`](./custom-list.tsx)           | `useAnnotateItems()` — your sidebar               |
| [`controlled-state.tsx`](./controlled-state.tsx) | `annotations` / `onChange`                        |
| [`persist.tsx`](./persist.tsx)                   | Save `Annotation[]` with `fetch`                  |
| [`zustand.tsx`](./zustand.tsx)                   | The same props on a Zustand store                 |
| [`measure.tsx`](./measure.tsx)                   | A measure button, not a map control               |
| [`fonts.tsx`](./fonts.tsx)                       | Custom font catalog on the provider               |
| [`mapbox.tsx`](./mapbox.tsx)                     | Mapbox + stock toolbar and list                   |
| [`maplibre.tsx`](./maplibre.tsx)                 | Same session on MapLibre                          |
| [`google.tsx`](./google.tsx)                     | Same session on Google Maps                       |
| [`leaflet.tsx`](./leaflet.tsx)                   | Same session on Leaflet                           |
| [`arcgis.tsx`](./arcgis.tsx)                     | Same session on ArcGIS                            |

Import `Annotate` from the entry that matches the map you render (`/mapbox`,
`/maplibre`, `/google`, `/leaflet`, `/arcgis`). The root import is Mapbox.
