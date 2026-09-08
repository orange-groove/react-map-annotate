import { describe, expect, it } from "vitest";
import type { Annotation } from "../types";
import {
  canGroupAnnotations,
  canUngroupAnnotations,
  expandGroupIds,
  groupAnnotations,
  idIsSelected,
  isAdditiveSelect,
  nextSelectedIds,
  remapPastedGroupIds,
  toggleSelectedIds,
  ungroupAnnotations,
} from "./selection";

const a: Annotation = {
  id: "a",
  kind: "marker",
  label: "A",
  coordinate: [-73.9, 40.7],
};
const b: Annotation = {
  id: "b",
  kind: "marker",
  label: "B",
  coordinate: [-73.8, 40.7],
};
const c: Annotation = {
  id: "c",
  kind: "line",
  label: "C",
  coordinates: [
    [-73.9, 40.7],
    [-73.8, 40.8],
  ],
  groupId: "g1",
};
const d: Annotation = {
  id: "d",
  kind: "line",
  label: "D",
  coordinates: [
    [-73.7, 40.7],
    [-73.6, 40.8],
  ],
  groupId: "g1",
};

describe("expandGroupIds", () => {
  it("includes every member of a selected group", () => {
    expect(expandGroupIds([a, c, d], ["c"])).toEqual(["c", "d"]);
  });

  it("leaves ungrouped ids unchanged", () => {
    expect(expandGroupIds([a, b], ["a"])).toEqual(["a"]);
  });
});

describe("nextSelectedIds", () => {
  it("replaces the selection without a modifier", () => {
    expect(nextSelectedIds([a, b], ["a"], "b")).toEqual(["b"]);
  });

  it("toggles a group additively", () => {
    expect(nextSelectedIds([a, c, d], ["a"], "c", true)).toEqual([
      "a",
      "c",
      "d",
    ]);
    expect(toggleSelectedIds([a, c, d], ["a", "c", "d"], "c")).toEqual(["a"]);
  });

  it("clears when the id is null", () => {
    expect(nextSelectedIds([a, b], ["a"], null)).toEqual([]);
  });
});

describe("group and ungroup", () => {
  it("assigns a shared group id to the selection", () => {
    const next = groupAnnotations([a, b, c], ["a", "b"]);
    const grouped = next.filter((item) => item.id === "a" || item.id === "b");
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.groupId).toBeTruthy();
    expect(grouped[0]?.groupId).toBe(grouped[1]?.groupId);
    expect(next.find((item) => item.id === "c")?.groupId).toBe("g1");
  });

  it("clears group ids for the selected groups", () => {
    const next = ungroupAnnotations([a, c, d], ["c"]);
    expect(next.find((item) => item.id === "c")?.groupId).toBeUndefined();
    expect(next.find((item) => item.id === "d")?.groupId).toBeUndefined();
  });

  it("knows when the selection can group or ungroup", () => {
    expect(canGroupAnnotations([a, b], ["a", "b"])).toBe(true);
    expect(canGroupAnnotations([c, d], ["c", "d"])).toBe(false);
    expect(canUngroupAnnotations([c, d], ["c"])).toBe(true);
    expect(canUngroupAnnotations([a, b], ["a", "b"])).toBe(false);
  });
});

describe("remapPastedGroupIds", () => {
  it("assigns a fresh group id shared by the pasted members", () => {
    const pasted = remapPastedGroupIds([c, d]);
    expect(pasted[0]?.groupId).toBeTruthy();
    expect(pasted[0]?.groupId).not.toBe("g1");
    expect(pasted[0]?.groupId).toBe(pasted[1]?.groupId);
  });
});

describe("idIsSelected", () => {
  it("prefers the selected id list", () => {
    expect(idIsSelected("a", ["a", "b"], "b")).toBe(true);
    expect(idIsSelected("c", ["a", "b"], "c")).toBe(false);
    expect(idIsSelected("c", undefined, "c")).toBe(true);
  });
});

describe("isAdditiveSelect", () => {
  it("reads modifiers from the native event", () => {
    expect(isAdditiveSelect({ shiftKey: true })).toBe(true);
    expect(
      isAdditiveSelect({
        originalEvent: { metaKey: true },
      }),
    ).toBe(true);
    expect(
      isAdditiveSelect({
        nativeEvent: { ctrlKey: true },
      }),
    ).toBe(true);
    expect(
      isAdditiveSelect({
        getModifierState: (key: string) => key === "Shift",
      }),
    ).toBe(true);
    expect(isAdditiveSelect({ originalEvent: { shiftKey: false } })).toBe(
      false,
    );
  });
});
