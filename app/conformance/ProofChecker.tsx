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
          ? "Example verified. Its signature, odds, class, and creature seed agree. This example is not a player discovery."
          : "Verified. The signed site, rarity draw, class, and creature seed all agree.", result }
        : { kind: "invalid", message: "This result could not be verified. It may be incomplete or changed." });
    } catch {
      setCheck({ kind: "error", message: "Choose a saved encounter result in JSON format." });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return <div className={styles.checker}>
    <label className={styles.filePicker}>
      <span><strong>Check an encounter result</strong><small>Select a saved encounter file. It stays in this browser.</small></span>
      <span className={styles.fileButton}>Choose JSON</span>
      <input accept=".json,application/json" aria-label="Choose encounter result JSON" onChange={onFile} type="file" />
    </label>
    <p aria-live="polite" className={check ? `${styles.checkResult} ${styles[check.kind]}` : styles.checkResult} role="status">
      {busy ? "Verifying locally…" : check?.message ?? "Verification runs offline after this page has loaded."}
    </p>
    {check?.kind === "valid" && check.result && <dl className={styles.proofFacts}>
      <div><dt>Class</dt><dd>{check.result.className}</dd></div>
      <div><dt>Rarity draw</dt><dd>{check.result.draw.toLocaleString("en-US")} / 10,000,000</dd></div>
      <div><dt>Site region</dt><dd>({check.result.input.site.regionX}, {check.result.input.site.regionZ})</dd></div>
      <div><dt>Site number</dt><dd>{check.result.input.slot + 1}</dd></div>
    </dl>}
  </div>;
}
