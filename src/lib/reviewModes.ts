import type { MaskableReviewMode, ReviewMode } from "../types/review";

export type Visibility = "full" | "masked";

export interface ModeOption {
  value: ReviewMode;
  label: string;
  description: string;
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    value: "type-it",
    label: "Type It",
    description: "See the whole verse. Type the first letter of each word to move through it.",
  },
  {
    value: "memorize-it",
    label: "Memorize It",
    description: "Every other word is hidden — recall it before you can type past it.",
  },
  {
    value: "master-it",
    label: "Master It",
    description: "The whole verse is hidden. Recall every word from just its first letter.",
  },
  {
    value: "reference-it",
    label: "Reference It",
    description: "See the whole verse. Recall and type only the reference.",
  },
  {
    value: "verse-defender",
    label: "Verse Defender",
    description:
      "Asteroids descend toward your base. Type each word's first letter fast enough to blast it before it lands.",
  },
  {
    value: "lane-defender",
    label: "Lane Defender",
    description:
      "Words fall across four lanes — hit D/F/J/K to fire at the lane holding the correct next word.",
  },
];

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
