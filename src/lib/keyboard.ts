// Shared keyboard event filtering helpers.

export const NON_CHARACTER_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "CapsLock",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
]);

export function isPrintableCharacter(char: string): boolean {
  if (NON_CHARACTER_KEYS.has(char)) return false;
  // Named keys (like 'Shift' or 'Enter') have length > 1.
  return char.length === 1;
}
