import { useLayoutEffect, useRef, useState } from "react";
import { downloadBlob } from "../play/card-export";
import { emitWildsPlaytestEvent } from "../play/wilds-playtest-events";
import { identitySaveErrorMessage } from "./identity-save-error";

type PreparedDownload = { file: File; url: string; canShare: boolean };

function usesMobileFilePicker() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia("(pointer: coarse)").matches;
}

function canShareFile(file: File) {
  try { return typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true; }
  catch { return false; }
}

/** A prepared Seal belongs to this open Profile and identity activation. The
 * browser can acknowledge a handoff, but only the user observes the final file. */
export function useIdentitySealDownload(active: boolean, owner: string, prepare?: () => Promise<File>) {
  const [prepared, setPrepared] = useState<PreparedDownload | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef<{ file: PreparedDownload | null; busy: boolean } | null>(null);
  useLayoutEffect(() => {
    current.current = active ? { file: null, busy: false } : null;
    setPrepared(null);
    setBusy(false);
    setMessage("");
    return () => {
      if (current.current?.file) URL.revokeObjectURL(current.current.file.url);
      current.current = null;
    };
  }, [active, owner]);

  async function openFiles(download: PreparedDownload) {
    const scope = current.current;
    if (!scope || scope.file !== download) return;
    scope.busy = true;
    setBusy(true);
    try {
      await navigator.share({ files: [download.file] });
      if (current.current !== scope) return;
      setMessage("Identity Seal handed to the selected destination.");
      emitWildsPlaytestEvent("identity-save", "success");
    } catch (cause) {
      if (current.current !== scope) return;
      setMessage(cause instanceof Error && cause.name === "AbortError"
        ? "Save cancelled. Your Identity Seal is ready to download."
        : "The file picker could not open. Use Download Identity Seal to keep the file.");
      emitWildsPlaytestEvent("identity-save", "failure");
    } finally {
      if (current.current === scope) { scope.busy = false; setBusy(false); }
    }
  }

  async function save() {
    const scope = current.current;
    if (!scope || scope.busy || !prepare) return;
    if (!window.confirm("This Identity Seal stores this Receiz ID and full Wildz account continuity. Anyone who has it can authenticate this account. Save it now?")) return;
    scope.busy = true;
    setBusy(true);
    setMessage("Preparing your Identity Seal…");
    emitWildsPlaytestEvent("identity-save", "start");
    try {
      const file = await prepare();
      if (current.current !== scope) return;
      const mobile = usesMobileFilePicker();
      const download = { file, url: URL.createObjectURL(file), canShare: mobile && canShareFile(file) };
      if (scope.file) URL.revokeObjectURL(scope.file.url);
      scope.file = download;
      setPrepared(download);
      if (mobile) {
        if (download.canShare && navigator.userActivation?.isActive) await openFiles(download);
        else setMessage("Your Identity Seal is ready. Choose where to save it.");
      } else {
        downloadBlob(file, file.name);
        downloadRequested();
      }
    } catch (cause) {
      if (current.current !== scope) return;
      setMessage(identitySaveErrorMessage(cause));
      emitWildsPlaytestEvent("identity-save", "failure");
    } finally {
      if (current.current === scope) { scope.busy = false; setBusy(false); }
    }
  }

  function downloadRequested() {
    setMessage("Identity Seal download requested. Check your downloads.");
    emitWildsPlaytestEvent("identity-save", "success");
  }

  return { prepared, busy, message, save, downloadRequested, openFiles };
}
