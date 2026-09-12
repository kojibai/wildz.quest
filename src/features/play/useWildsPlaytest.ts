"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWildsPlaytestRecording, exportWildsPlaytest, markWildsPlaytest, recordWildsPlaytestFrame, recordWildsPlaytestLongTask, summarizeWildsPlaytest, type WildsPlaytestAction, type WildsPlaytestOutcome } from "./wilds-playtest";

const STORAGE_KEY = "wildz:local-playtest-enabled:v1";
export function useWildsPlaytest() {
  const [enabled, setEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [longTasksSupported, setLongTasksSupported] = useState(false);
  const recording = useRef(createWildsPlaytestRecording(0));
  const [summary, setSummary] = useState(() => summarizeWildsPlaytest(recording.current));
  useEffect(() => {
    try { setEnabled(localStorage.getItem(STORAGE_KEY) === "true"); } catch { /* Storage may be unavailable. */ }
    setInitialized(true);
  }, []);
  const reset = useCallback(() => {
    recording.current = createWildsPlaytestRecording(performance.now());
    setSummary(summarizeWildsPlaytest(recording.current));
  }, []);
  useEffect(() => {
    if (!initialized) return;
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* Recording does not depend on storage. */ }
    reset();
    if (!enabled) return;
    let previous = 0;
    let frame = 0;
    let observer: PerformanceObserver | undefined;
    const sample = (now: number) => {
      if (previous > 0) recordWildsPlaytestFrame(recording.current, now - previous);
      previous = now;
      frame = requestAnimationFrame(sample);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden) frame = requestAnimationFrame(sample);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    const supported = typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask");
    setLongTasksSupported(Boolean(supported));
    if (supported) {
      observer = new PerformanceObserver(list => {
        if (!document.hidden) for (const entry of list.getEntries()) recordWildsPlaytestLongTask(recording.current, entry.duration);
      });
      try { observer.observe({ type: "longtask" }); } catch { setLongTasksSupported(false); }
    }
    const interval = window.setInterval(() => setSummary(summarizeWildsPlaytest(recording.current)), 3000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, initialized, reset]);
  const mark = useCallback((action: WildsPlaytestAction, outcome: WildsPlaytestOutcome = "success") => {
    if (enabled) markWildsPlaytest(recording.current, action, outcome, performance.now());
  }, [enabled]);
  const download = useCallback(() => {
    if (!enabled) return;
    const blob = new Blob([JSON.stringify(exportWildsPlaytest(recording.current, longTasksSupported), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wildz-local-playtest.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [enabled, longTasksSupported]);
  return { enabled, setEnabled, summary, mark, reset, download, longTasksSupported };
}
export type WildsPlaytestController = ReturnType<typeof useWildsPlaytest>;
