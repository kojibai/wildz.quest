"use client";

import { useState, type ChangeEvent } from "react";
import { verifyWildsV11Birth, WILDS_CREATURE_CARD_V11, type WildsV11CreatureCard } from "@/features/play/wilds-card-proof-v11";
import { verifyEncounterResultV11, type WildsV11EncounterResult } from "@/features/play/wilds-encounter-proof-v11";
import { WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "@/features/play/wilds-v11-release-keys";
import { WILDS_V11_CONFORMANCE_KEY_ID, WILDS_V11_CONFORMANCE_PUBLIC_KEYS } from "@/features/play/wilds-v11-conformance-keys";
import styles from "../v11-reader.module.css";

type Check = { kind: "valid" | "invalid" | "error"; message: string; result?: WildsV11EncounterResult; birth?: WildsV11CreatureCard["birth"] };

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
      const card = (parsed as { schema?: unknown }).schema === WILDS_CREATURE_CARD_V11
        ? parsed as WildsV11CreatureCard : null;
      const result = card?.encounter ?? parsed as WildsV11EncounterResult;
      const example = result.input?.keyId === WILDS_V11_CONFORMANCE_KEY_ID;
      const keys = example ? WILDS_V11_CONFORMANCE_PUBLIC_KEYS : WILDS_V11_ENCOUNTER_PUBLIC_KEYS;
      const valid = card ? await verifyWildsV11Birth(card, keys) : await verifyEncounterResultV11(result, keys);
      setCheck(valid
        ? { kind: "valid", message: example
          ? "Example verified. Its signature, odds, and creature details agree. This example is not a player discovery."
          : card ? "Verified. This creature’s birth, rarity, and encounter proof all agree."
            : "Verified. The signed site, rarity draw, class, and creature seed all agree.", result,
          ...(card ? { birth: card.birth } : {}) }
        : { kind: "invalid", message: "This file could not be verified. It may be incomplete or changed." });
    } catch {
      setCheck({ kind: "error", message: "Choose a saved creature proof or encounter result in JSON format." });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return <div className={styles.checker}>
    <label className={styles.filePicker}>
      <span><strong>Check a creature’s proof</strong><small>Select a saved creature proof or encounter result. It stays in this browser.</small></span>
      <span className={styles.fileButton}>Choose JSON</span>
      <input accept=".json,application/json" aria-label="Choose creature proof or encounter result JSON" onChange={onFile} type="file" />
    </label>
    <p aria-live="polite" className={check ? `${styles.checkResult} ${styles[check.kind]}` : styles.checkResult} role="status">
      {busy ? "Verifying locally…" : check?.message ?? "Verification runs offline after this page has loaded."}
    </p>
    {check?.kind === "valid" && check.result && <dl className={styles.proofFacts}>
      <div><dt>Class</dt><dd>{check.result.className}</dd></div>
      <div><dt>Rarity draw</dt><dd>{check.result.draw.toLocaleString("en-US")} / 10,000,000</dd></div>
      <div><dt>Site region</dt><dd>({check.result.input.site.regionX}, {check.result.input.site.regionZ})</dd></div>
      <div><dt>Site number</dt><dd>{check.result.input.slot + 1}</dd></div>
      {check.birth && <><div><dt>Nature</dt><dd>{check.birth.temperament} · {check.birth.habitat}</dd></div><div><dt>Body</dt><dd>{check.birth.body.body} · {check.birth.body.detail} · {check.birth.body.gait}</dd></div></>}
    </dl>}
  </div>;
}
