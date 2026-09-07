import {
  DEFAULT_STROKE_WIDTH,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  fontPickerOptions,
  isArrowAnnotation,
  useAnnotateFonts,
  useAnnotateItems,
} from "@orange-groove/react-map-annotate/core";

export function CustomList() {
  const items = useAnnotateItems();
  const fonts = useAnnotateFonts();

  if (items.length === 0) return <p>No annotations</p>;

  return (
    <ul>
      {items.map((item) => {
        const fontOptions = fontPickerOptions(fonts, item.fontFamily);
        return (
          <li
            key={item.id}
            className={item.isSelected ? "is-selected" : undefined}
            onClick={item.select}
          >
            <span>{item.kindLabel}</span>
            <input
              type="color"
              value={item.color}
              onChange={(event) => item.setColor(event.target.value)}
            />
            <input
              value={item.label}
              onChange={(event) => item.setLabel(event.target.value)}
            />
            <button type="button" onClick={item.remove}>
              Delete
            </button>
            {item.kind === "text" ? (
              <select
                value={item.fontFamily ?? ""}
                onChange={(event) =>
                  item.setStyle({
                    fontFamily: event.target.value || undefined,
                  })
                }
              >
                {fontOptions.map((option) => (
                  <option key={option.family || "system"} value={option.family}>
                    {option.label ?? option.family}
                  </option>
                ))}
              </select>
            ) : null}
            {isArrowAnnotation(item.annotation) ? (
              <input
                type="range"
                min={MIN_STROKE_WIDTH}
                max={MAX_STROKE_WIDTH}
                value={
                  item.annotation.style?.strokeWidth ?? DEFAULT_STROKE_WIDTH
                }
                onChange={(event) =>
                  item.setStyle({
                    strokeWidth: Number(event.target.value),
                  })
                }
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
