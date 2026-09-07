import { describe, expect, it, vi } from "vitest";
import type { AnnotateFont } from "../types";
import {
  fontFaceFamilyName,
  fontPickerOptions,
  fontStylesheetHrefs,
  loadAnnotateFontFaces,
  resolveAnnotateFonts,
} from "./fonts";
import { TEXT_FONTS } from "../constants";

describe("resolveAnnotateFonts", () => {
  it("falls back to the built-in catalog", () => {
    expect(resolveAnnotateFonts()).toBe(TEXT_FONTS);
  });

  it("uses the injected catalog", () => {
    const fonts: AnnotateFont[] = [{ family: '"Inter"', label: "Inter" }];
    expect(resolveAnnotateFonts(fonts)).toBe(fonts);
  });
});

describe("fontPickerOptions", () => {
  it("appends the current family when it is not in the catalog", () => {
    const fonts: AnnotateFont[] = [
      { family: "Georgia, serif", label: "Georgia" },
    ];
    expect(fontPickerOptions(fonts, '"Inter"')).toEqual([
      ...fonts,
      { family: '"Inter"', label: '"Inter"' },
    ]);
    expect(fontPickerOptions(fonts, "Georgia, serif")).toEqual(fonts);
  });
});

describe("fontStylesheetHrefs", () => {
  it("dedupes stylesheet URLs", () => {
    expect(
      fontStylesheetHrefs([
        {
          family: "Inter",
          stylesheet: "https://fonts.example/inter.css",
        },
        {
          family: "Inter Bold",
          stylesheet: "https://fonts.example/inter.css",
        },
        { family: "Georgia, serif" },
      ]),
    ).toEqual(["https://fonts.example/inter.css"]);
  });
});

describe("fontFaceFamilyName", () => {
  it("uses the first unquoted family name", () => {
    expect(fontFaceFamilyName('"Outfit", sans-serif')).toBe("Outfit");
    expect(fontFaceFamilyName("Georgia, serif")).toBe("Georgia");
  });
});

describe("loadAnnotateFontFaces", () => {
  it("registers FontFace sources and cleans them up", () => {
    class FakeFontFace {
      family: string;
      constructor(family: string) {
        this.family = family;
      }
      load() {
        return Promise.resolve(this);
      }
    }
    const added: FakeFontFace[] = [];
    const fontsApi = {
      add: vi.fn((face: FakeFontFace) => {
        added.push(face);
      }),
      delete: vi.fn(),
    };
    const originalDocument = globalThis.document;
    const originalFontFace = globalThis.FontFace;
    vi.stubGlobal("FontFace", FakeFontFace);
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { fonts: fontsApi },
    });

    const unload = loadAnnotateFontFaces([
      { family: '"Outfit"', source: "url(/outfit.woff2)" },
      { family: "Georgia, serif" },
    ]);
    expect(fontsApi.add).toHaveBeenCalledTimes(1);
    expect(added[0]?.family).toBe("Outfit");
    unload();
    expect(fontsApi.delete).toHaveBeenCalledWith(added[0]);

    vi.stubGlobal("FontFace", originalFontFace);
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });
});
