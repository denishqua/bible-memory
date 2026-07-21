import type { ChangeEvent, CSSProperties, RefObject } from "react";

interface HiddenTypingInputProps {
  // Called once per character typed since the last change (see onChange below).
  onChar: (char: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  // Threaded through so the host can focus programmatically (mount / retry /
  // hint) and its wrapper's click-to-focus can reach the input.
  inputRef?: RefObject<HTMLInputElement | null>;
  // Extra style merged over the base — the sessions differ only in overlay
  // stacking (pointerEvents / zIndex).
  style?: CSSProperties;
}

// Visually hidden but focused/focusable input — drives per-character typing
// from onChange rather than a bare document keydown listener, so mobile virtual
// keyboards actually work. The value is always driven back to "" (controlled),
// so every character present in a change was typed since the last one — each is
// processed in order rather than assuming only one arrived.
export function HiddenTypingInput({ onChar, disabled, ariaLabel, inputRef, style }: HiddenTypingInputProps) {
  return (
    <input
      ref={inputRef}
      value=""
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        for (const char of event.target.value) {
          onChar(char);
        }
      }}
      aria-label={ariaLabel}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        border: "none",
        outline: "none",
        background: "transparent",
        caretColor: "transparent",
        fontSize: "16px",
        ...style,
      }}
    />
  );
}
