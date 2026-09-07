"use client";
import { useId, useState } from "react";

/** Blocked controls remain focusable and explain themselves without executing the action. */
export function WildsExplainedAction({ label, blocker, pending = false, onAction, className }: { label: string; blocker?: string | null; pending?: boolean; onAction?: () => void; className?: string }) {
  const id = useId();
  const [attempt, setAttempt] = useState(0);
  const reason = pending ? "Saving your current action. Wait for it to finish; this button will become available automatically." : blocker;
  return <div className={`wilds-explained-action ${className ?? ""}`}>
    <button type="button" aria-disabled={Boolean(reason)} aria-describedby={reason ? id : undefined} onClick={() => reason ? setAttempt(value => value + 1) : onAction?.()}>{pending ? "Saving…" : label}</button>
    {reason && <p id={id} key={attempt} role={attempt ? "status" : undefined}>{reason}</p>}
  </div>;
}
