import type { WildsInput } from "./game-state";

type WorldKeyboardEvent = Pick<KeyboardEvent, "key" | "defaultPrevented" | "target">;

const INTERACTIVE_KEYBOARD_TARGET = [
  "input",
  "textarea",
  "select",
  "button",
  "[contenteditable='true']",
  "[role='listbox']",
  "[role='option']",
  "[role='menu']",
  "[role='dialog']"
].join(", ");

export function worldInputForKeyboardEvent(
  event: WorldKeyboardEvent,
  occurredAt: () => string = () => new Date().toISOString()
): WildsInput | null {
  if (event.defaultPrevented) return null;
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (target?.closest?.(INTERACTIVE_KEYBOARD_TARGET)) return null;
  const key = event.key.toLowerCase();
  return key === "arrowup" || key === "w" ? { type: "move", direction: "north" }
    : key === "arrowdown" || key === "s" ? { type: "move", direction: "south" }
      : key === "arrowleft" || key === "a" ? { type: "move", direction: "west" }
        : key === "arrowright" || key === "d" ? { type: "move", direction: "east" }
          : key === "t" ? { type: "train", at: occurredAt() }
            : key === "m" ? { type: "mission" }
              : key === "r" ? { type: "rest", at: occurredAt() }
                : null;
}
