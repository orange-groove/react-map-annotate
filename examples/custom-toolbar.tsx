import {
  AnnotateToolIcon,
  useAnnotateTools,
} from "@orange-groove/react-map-annotate/core";

export function CustomToolbar() {
  const { items, finish, canFinish, selectedId, deleteSelected } =
    useAnnotateTools(["line", "polygon", "measure", "marker"]);

  return (
    <div role="toolbar" aria-label="Annotation tools">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.active}
          onClick={item.select}
        >
          <AnnotateToolIcon tool={item.id} />
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
