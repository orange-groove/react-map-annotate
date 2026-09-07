import { useAnnotate } from "@orange-groove/react-map-annotate/core";

export function MeasureTool() {
  const { setTool, finish, canFinish } = useAnnotate();

  return (
    <div role="toolbar" aria-label="Measure">
      <button type="button" onClick={() => setTool("measure")}>
        Measure
      </button>
      <button type="button" disabled={!canFinish} onClick={finish}>
        Done
      </button>
    </div>
  );
}
