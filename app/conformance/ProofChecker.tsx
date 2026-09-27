"use client";

import { useState, type ChangeEvent } from "react";
import { verifyEncounterResultV11, type WildsV11EncounterResult } from "@/features/play/wilds-encounter-proof-v11";
import { WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "@/features/play/wilds-v11-release-keys";
import { WILDS_V11_CONFORMANCE_KEY_ID, WILDS_V11_CONFORMANCE_PUBLIC_KEYS } from "@/features/play/wilds-v11-conformance-keys";
import styles from "../v11-reader.module.css";

type Check = { kind: "valid" | "invalid" | "error"; message: string; result?: WildsV11EncounterResult };

export default function ProofChecker() {
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCheck(null);
    if (!file) return;
    if (file.size > 64 * 1024) {
      setCheck({ kind: "error", message: "This file is too large for an encounter result (64 KB maximum)." });
      return;
    }
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("file_shape");
      const result = parsed as WildsV11EncounterResult;
      const example = result.input?.keyId === WILDS_V11_CONFORMANCE_KEY_ID;
      const valid = await verifyEncounterResultV11(result, example ? WILDS_V11_CONFORMANCE_PUBLIC_KEYS : WILDS_V11_ENCOUNTER_PUBLIC_KEYS);
      setCheck(valid
        ? { kind: "valid", message: example
          ? "Synthetic example verified: signature, law, draw, class and seed agree. This is not an admitted player encounter."
          : "Admitted encounter key, signature, rarity draw, class, creature seed and site address all agree.", result }
        : { kind: "invalid", message: "This result does not verify under the published v11 law and release key." });
    } catch {
      setCheck({ kind: "error", message: "Choose a v11 encounter-result JSON file." });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return <div className={styles.checker}>
    <label className={styles.filePicker}>
      <span><strong>Check an encounter result</strong><small>Select a saved v11 JSON result. The file stays in this browser.</small></span>
      <span className={styles.fileButton}>Choose JSON</span>
      <input accept=".json,application/json" aria-label="Choose v11 encounter result JSON" onChange={onFile} type="file" />
    </label>
    <p aria-live="polite" className={check ? `${styles.checkResult} ${styles[check.kind]}` : styles.checkResult} role="status">
      {busy ? "Verifying locally…" : check?.message ?? "Verification runs offline after this page has loaded."}
    </p>
    {check?.kind === "valid" && check.result && <dl className={styles.proofFacts}>
      <div><dt>Class</dt><dd>{check.result.className}</dd></div>
      <div><dt>Rarity draw</dt><dd>{check.result.draw.toLocaleString("en-US")} / 10,000,000</dd></div>
      <div><dt>Site region</dt><dd>({check.result.input.site.regionX}, {check.result.input.site.regionZ})</dd></div>
      <div><dt>Slot</dt><dd>{check.result.input.slot}</dd></div>
      <div><dt>Key</dt><dd>{check.result.input.keyId}</dd></div>
    </dl>}
  </div>;
}
