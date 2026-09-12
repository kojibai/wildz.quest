import { createWildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { createWildzIdentityRepository } from "./wildz-identity-repository";

// Shared authority without importing UI, export workers, or restore orchestration.
export const defaultContinuityDatabase = createWildzContinuityDatabase();
export const defaultIdentityRepository = createWildzIdentityRepository({ database: defaultContinuityDatabase });
