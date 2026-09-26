import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { WildzWorldControls } from "../src/features/play/WildzWorldControls";

export function passiveControlsMarkup(capabilities: ComponentProps<typeof WildzWorldControls>["traversalCapabilities"]) {
  const noop = () => {};
  return renderToStaticMarkup(<WildzWorldControls
    nearbyCards={[]} activeCard={null} companionProgress={{}} cardConditions={{}}
    cameraHeadingRef={{ current: 0 }} movementMode="walk" cardOrder="rarity"
    commandItems={[]} dismissSignal={0} exclusiveOwner="none"
    overlayState={{ exclusiveOwner: "none", toolsOpen: false, panelKey: null, drawerSnap: "closed" }}
    overlayDispatch={noop} gestureCancelSignal={0} newRosterAssetId={null}
    onCardOrderChange={noop} onInput={noop} onMovementModeChange={noop} onSelectCard={noop} onRest={noop}
    aerialEnergy={100} aerialMode="ground" traversalCapabilities={capabilities}
    onAerialToggle={noop}
    capabilityControls={[{ assetId: "fixture", family: "quarry", label: "Mine rock", action: "Mine rock",
      icon: "quarry", unlockLevel: 1, capacity: 85, currentPower: 85, runtimeAvailable: true }]}
  />);
}

test("passive traversal badges follow the active capability set without adding action buttons", () => {
  const swimmer = passiveControlsMarkup(["swim", "climb"]);
  const land = passiveControlsMarkup([]);
  assert.match(swimmer, /role="img" aria-label="Automatic swimming"/);
  assert.match(swimmer, /role="img" aria-label="Automatic climbing"/);
  assert.doesNotMatch(swimmer, /<b>Swim|<b>Climb|<small>passive/);
  assert.doesNotMatch(land, /wildz-passive-capabilities/);
  assert.equal((swimmer.match(/<button/g) ?? []).length, (land.match(/<button/g) ?? []).length);
  assert.ok(swimmer.indexOf('class="wildz-passive-capabilities"') < swimmer.indexOf('aria-label="Make camp and recover"'), "passive strip precedes all action controls");
});
