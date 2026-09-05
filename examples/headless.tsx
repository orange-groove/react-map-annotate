import { useAnnotate } from "@orange-groove/react-map-annotate";

export function HeadlessChrome() {
  const { tool, setTool, finish, canFinish, selectedId, onDelete, setLabel } =
    useAnnotate();

  return (
    <header>
      <button
        type="button"
        aria-pressed={tool === "polygon"}
        onClick={() => setTool("polygon")}
      >
        Fence
      </button>
      <button
        type="button"
        aria-pressed={tool === "measure"}
        onClick={() => setTool("measure")}
      >
        Measure
      </button>
      <button type="button" disabled={!canFinish} onClick={finish}>
        Done
      </button>
      <button
        type="button"
        disabled={!selectedId}
        onClick={() => {
          if (selectedId) onDelete(selectedId);
        }}
      >
        Remove
      </button>
      <button
        type="button"
        disabled={!selectedId}
        onClick={() => {
          if (selectedId) setLabel(selectedId, "North fence");
        }}
      >
        Name selection
      </button>
    </header>
  );
}
