import { describe, expect, it } from "vitest";
import { initialVisibility } from "../reviewModes";

describe("initialVisibility", () => {
  it("type-it: every word starts full", () => {
    for (let i = 0; i < 8; i++) {
      expect(initialVisibility("type-it", i)).toBe("full");
    }
  });

  it("memorize-it: fixed alternating pattern starting full at index 0", () => {
    expect(initialVisibility("memorize-it", 0)).toBe("full");
    expect(initialVisibility("memorize-it", 1)).toBe("masked");
    expect(initialVisibility("memorize-it", 2)).toBe("full");
    expect(initialVisibility("memorize-it", 3)).toBe("masked");
  });

  it("master-it: every word starts masked", () => {
    for (let i = 0; i < 8; i++) {
      expect(initialVisibility("master-it", i)).toBe("masked");
    }
  });
});
