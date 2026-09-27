"use client";

import { useState, type ChangeEvent } from "react";
import { inspectWildsProofFile, type WildsProofInspectionV11 } from "@/features/play/wilds-proof-inspection-v11";
import styles from "../v11-reader.module.css";

type Check = { kind: "valid" | "invalid" | "error"; message: string; inspection?: WildsProofInspectionV11 };

export default function ProofChecker() {
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCheck(null);
    if (!file) return;
    if (file.size > 64 * 1024) {
      setCheck({ kind: "error", message: "This file is too large to check here (64 KB maximum)." });
      return;
    }
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("file_shape");
      const inspection = await inspectWildsProofFile(parsed);
      setCheck(inspection
        ? { kind: "valid", message: inspection.example
          ? inspection.artifact === "encounter"
            ? "Example verified. Its signature, odds, class, and creature seed agree. This is not a player discovery."
            : inspection.artifact === "local-card"
              ? "Example birth and local card verified. This is not a player discovery or proof of current ownership."
              : "Example verified. Its signature, odds, and creature details agree. This is not a player discovery."
          : inspection.artifact === "local-card" ? "Birth and local card bytes verified. Current ownership requires a separate custody check."
            : inspection.artifact === "birth" ? "Verified. This creature’s birth, rarity, and encounter proof all agree."
              : "Verified. The signed site, rarity draw, class, and creature seed all agree.", inspection }
        : { kind: "invalid", message: "This file could not be verified. It may be incomplete or changed." });
    } catch {
      setCheck({ kind: "error", message: "Choose a saved creature card, birth proof, or encounter result in JSON format." });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return <div className={styles.checker}>
    <label className={styles.filePicker}>
      <span><strong>Check a creature’s proof</strong><small>Select a saved card, birth proof, or encounter result. It stays in this browser.</small></span>
      <span className={styles.fileButton}>Choose JSON</span>
      <input accept=".json,application/json" aria-label="Choose creature card or encounter proof JSON" onChange={onFile} type="file" />
    </label>
    <p aria-live="polite" className={check ? `${styles.checkResult} ${styles[check.kind]}` : styles.checkResult} role="status">
      {busy ? "Verifying locally…" : check?.message ?? "Verification runs offline after this page has loaded."}
    </p>
    {check?.kind === "valid" && check.inspection && <dl className={styles.proofFacts}>
      <div><dt>Class</dt><dd>{check.inspection.result.className}</dd></div>
      <div><dt>Rarity draw</dt><dd>{check.inspection.result.draw.toLocaleString("en-US")} / 10,000,000</dd></div>
      <div><dt>Site region</dt><dd>({check.inspection.result.input.site.regionX}, {check.inspection.result.input.site.regionZ})</dd></div>
      <div><dt>Site number</dt><dd>{check.inspection.result.input.slot + 1}</dd></div>
      {check.inspection.birth && <><div><dt>Nature</dt><dd>{check.inspection.birth.temperament} · {check.inspection.birth.habitat}</dd></div><div><dt>Body</dt><dd>{check.inspection.birth.body.body} · {check.inspection.birth.body.detail} · {check.inspection.birth.body.gait}</dd></div></>}
    </dl>}
  </div>;
}
