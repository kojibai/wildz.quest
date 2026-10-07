import type { CreationCompileContext } from "./compiler";
import { projectCreationCompilePhysical } from "./compile-environment";
import { creationWorldSourceHead } from "./world-source";
import type { WildsWorldProjection } from "../wilds-world-state";

export type CreationContextSeed = Omit<CreationCompileContext, "sourceHead" | "physical">;

export function projectActiveCreationContext(input: {
  active: boolean;
  context: CreationContextSeed | null;
  world: () => WildsWorldProjection;
  physical: Omit<Parameters<typeof projectCreationCompilePhysical>[0], "worldId" | "spaceId" | "sourceHead">;
}): CreationCompileContext | null {
  if (!input.active || !input.context) return null;
  const sourceHead = creationWorldSourceHead(input.world());
  return { ...input.context, sourceHead, physical: projectCreationCompilePhysical({ ...input.context, ...input.physical, sourceHead }) };
}
