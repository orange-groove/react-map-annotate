import { useAnnotateItems } from "@orange-groove/react-map-annotate/core";

export function CustomList() {
  const items = useAnnotateItems();

  if (items.length === 0) return <p>No annotations</p>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.kindLabel}</span>
          <input
            value={item.label}
            onChange={(event) => item.setLabel(event.target.value)}
          />
          <input
            type="color"
            value={item.color}
            onChange={(event) => item.setColor(event.target.value)}
          />
          <button type="button" onClick={item.remove}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
