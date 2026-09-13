import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createOwnerBoundInitialPlayState, type PlayState } from "../src/features/play/game-state";
import { canOperateWildzCrewCard } from "../src/lib/receiz/wildz-artifact-codec";
import { setWildsCrewPreference } from "../src/features/play/wilds-crew-preferences";

// Execute the actual campaign command with unavailable transfer services. This
// reproduces the ordering regression without mounting the entire 3D application.
test("Roam starts and saves its preference without wallet or capture preparation", async () => {
  const source = ts.createSourceFile("PlayCampaign.tsx", readFileSync("src/features/play/PlayCampaign.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleCrewModeChange") handler = node.initializer!.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(handler);
  const js = ts.transpile(`return (${handler});`, { target: ts.ScriptTarget.ES2022 });
  let state = createOwnerBoundInitialPlayState("roam_keeper", "2026-09-13T12:00:00.000Z");
  const asset = state.inventory[0]!;
  let starts = 0, transferCalls = 0;
  const errors: string[] = [];
  const scope = {
    state, ownerReceizId: "roam_keeper", crewCustody: null, networkEnabled: true,
    canOperateWildzCrewCard, setWildsCrewPreference,
    crewExpeditions: { roam: async () => { starts++; return true; }, recall: async () => false },
    walletController: { secureTransferAuthority: async () => { transferCalls++; throw Error("wallet unavailable"); } },
    prepareWildsRoamingOwnerFile: async () => { transferCalls++; throw Error("capture service unavailable"); },
    showWorldFeedback: (message: string) => errors.push(message),
    crewControlScope: { current: { owner: "roam_keeper", inventory: state.inventory, custody: null } },
    setState: (update: (prior: PlayState) => PlayState) => { state = update(state); },
    recordWildsCrewModeObservation: async () => undefined
  };
  const command = new Function(...Object.keys(scope), js)(...Object.values(scope)) as (id: string, mode: "roam") => Promise<void>;
  await command(asset.id, "roam");
  assert.equal(starts, 1);
  assert.equal(state.crewPreferences?.byAssetId[asset.id], "roam");
  assert.equal(transferCalls, 0);
  assert.deepEqual(errors, []);
});
