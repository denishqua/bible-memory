import type { MaskableReviewMode } from "../types/review";

export type Visibility = "full" | "masked";

// The *only* thing that differs per mode — everything else in the review engine
// (tokenizing, advancing on a correct first-letter keystroke, reveal-on-miss) is
// shared. A future 4th mask-based mode is just a new case here.
export function initialVisibility(mode: MaskableReviewMode, wordIndex: number): Visibility {
  switch (mode) {
    case "type-it":
    case "reference-it":
      return "full";
    case "memorize-it":
      // Fixed alternating pattern, not randomized.
      return wordIndex % 2 === 0 ? "full" : "masked";
    case "master-it":
      return "masked";
  }
}
