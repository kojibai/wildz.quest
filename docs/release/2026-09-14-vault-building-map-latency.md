# Growing Vault, building and atlas performance

The player-state worker now receives only changed admitted cards after its first snapshot. Adding one card sends one card rather than recopying the entire restored Vault. Existing movement-only inventory reuse remains in place. The worker reconstructs the exact inventory before the normal player-vault normalization and digest path. Removal, append, worker restart and unchanged-card verifier behavior have regression coverage.

Movement-only shell persistence no longer prunes the unchanged crew-custody inventory on every update. Inventory changes retain pruning.

Construction function lookup rejects unrelated piece kinds before scanning contributions. Exact deeply immutable construction, material, work, condition and material-custody collections share verified results across movement and unrelated world revisions. Mutable inputs retain the verifier path. Tests cover 100 reuses, changed custody, and mutated imported inputs.

Atlas terrain geometry uses tile-local coordinates. Changing the floating map origin moves the mesh instead of rebuilding its vertex, color, index and normal buffers. Sampling, world-space hit coordinates and visual terrain retain the same formulas.

Validation: 2,682 tests pass. Production build and targeted lint pass. Architecture lock passes. Existing construction benchmark remains equivalent: 20 components/100 material contributions; warm ungrouped projection 0.105 ms, grouped 0.016 ms, worker-cloned 3.178 ms. These are CPU measurements, not a universal zero-latency claim. The final optional-empty-condition cache correction is covered by the full tests; the subsequent advanced-building build will include it in browser validation.
