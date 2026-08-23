import type { ReceizCommerceAdapter } from "./adapter";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";

export const WILDZ_V124_TWIN_OPERATIONS = Object.freeze([
  "subject.resolve",
  "subject.brain.retrieve",
  "subject.twin.message",
  "subject.memory.project",
  "subject.namespaces.resolve"
] as const);

export const WILDZ_V124_WORLD_OPERATIONS = Object.freeze([
  "world.command.plan",
  "world.command.execute",
  "world.transaction.plan",
  "world.transaction.execute",
  "domain.verified-additions.resolve",
  "domain.replay.verify",
  "domain.checkpoint.verify",
  "domain.private-additions.resolve",
  "execution.stage",
  "execution.execute",
  "execution.resolve",
  "execution.resolve-by-idempotency-key",
  "execution.cancel",
  "execution.atomic-mutation.plan"
] as const);

export const WILDZ_V124_VALUE_OPERATIONS = Object.freeze([
  "identity.proof-authority.exchange",
  "authorization.scopes.introspect",
  "identity.public-recipient.resolve",
  "value.settlement.execute",
  "value.reserve.execute",
  "value.execution.resolve",
  "execution.stage",
  "execution.execute",
  "execution.resolve",
  "execution.resolve-by-idempotency-key",
  "execution.cancel"
] as const);

type RuntimeRail = Pick<ReceizCommerceAdapter, "qualifyRuntimeV124">;

/**
 * Operational qualification can authorize no action. It only prevents an
 * optional remote rail from entering a live path when its complete production
 * dependencies are unavailable. Local proof truth never waits for this call.
 */
export async function qualifyWildzV124Operations(
  rail: RuntimeRail,
  operations: readonly string[]
) {
  const requested = [...new Set(operations)];
  const report = await rail.qualifyRuntimeV124({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    operations: requested
  });
  const results = new Map(report.results.map((result) => [result.operation, result]));
  const available = requested.every((operation) => results.get(operation)?.status === "available");
  return Object.freeze({
    available,
    report,
    unavailable: Object.freeze(requested.filter((operation) => results.get(operation)?.status !== "available"))
  });
}
