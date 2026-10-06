# Player breath energy — authorized follow-up

Use the existing exact Kai day (`KAI_N_DAY_MICRO`), with 17,491 breath equivalents in the player reserve. Charge actual distance and successful exertion, never input count. Camp/bed recovery follows elapsed breaths; repeated rest clicks cannot grant energy or healing. Account saves retain the exact reserve and fractional clock remainder. Legacy energy migrates without a refill. No additional service or dependency.

Tests: exact day rollover, fractional time conservation, input-rate independence, blocked movement, regressed time, bounded offline recovery, repeated rest, meaningful action costs, save/restore, and current HUD readout. Full test suite and typecheck required. This is game energy accounting; local state is not economic authority.
