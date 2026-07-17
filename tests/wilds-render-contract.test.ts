import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Receiz Wilds rendering contract", () => {
  it("opens a focus-safe 3D atlas with an accessible fallback", async () => {
    const map = await readFile("src/features/play/WildsWorldMap.tsx", "utf8");
    const canvas = await readFile("src/features/play/WildsAtlasCanvas.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");

    assert.match(map, /role="dialog"/);
    assert.match(map, /aria-modal="true"/);
    assert.match(map, /aria-label="Close world map"/);
    assert.match(map, /aria-label="Hold to Rift Drop"/);
    assert.match(map, /landmarkApproachPoint\(selected\)/);
    assert.match(map, /walk to the physical entrance/);
    assert.match(map, /wilds-atlas-fallback/);
    assert.match(map, /createPortal/);
    assert.match(map, /document\.body/);
    assert.match(map, /\.focus\(\)/);
    assert.match(map, /event\.key === "Escape"/);
    assert.match(map, /previousFocus/);
    assert.match(canvas, /<Canvas/);
    assert.match(canvas, /OrbitControls/);
    assert.match(canvas, /maxDistance/);
    assert.match(canvas, /qualityProfile\.dpr/);
    assert.match(canvas, /instancedMesh/);
    assert.match(canvas, /function AtlasHorizon/);
    assert.doesNotMatch(canvas, /gridHelper/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.wilds-world-map-header h2\s*\{[^}]*white-space:\s*normal/s);
  });

  it("renders an organic world map and lets explorers confirm any terrain coordinate", async () => {
    const map = await readFile("src/features/play/WildsWorldMap.tsx", "utf8");
    const canvas = await readFile("src/features/play/WildsAtlasCanvas.tsx", "utf8");

    assert.match(canvas, /function OrganicWorldSurface/);
    assert.match(canvas, /onDrop/);
    assert.match(canvas, /DropPin/);
    assert.match(canvas, /ExactPlayerLights/);
    assert.match(canvas, /atlas-live-players/);
    assert.doesNotMatch(canvas, /gridHelper/);
    assert.match(map, /Travel here\?/);
    assert.match(map, /onRift\(freeDrop\)/);
    assert.match(map, /Confirm Rift travel/);
  });

  it("shares stable named geography between the atlas and walkable world", async () => {
    const atlas = await readFile("src/features/play/WildsAtlasCanvas.tsx", "utf8");
    const environment = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");
    const geography = await readFile("src/features/play/wilds-world-geography.ts", "utf8");

    assert.match(atlas, /WILDS_MAJOR_ROUTES/);
    assert.match(atlas, /WILDS_NAMED_REGIONS/);
    assert.match(environment, /WILDS_MAJOR_ROUTES/);
    assert.match(environment, /world-major-routes/);
    assert.match(geography, /Verdant Heartlands/);
    assert.match(geography, /Echo Highlands/);
    assert.match(geography, /Prism Coast/);
  });

  it("connects the Kai command pill, atlas, Rift travel, Walk Run, and Pulse to the playable world", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const referenceHud = await readFile("src/features/play/WildzReferenceHud.tsx", "utf8");
    const minimap = await readFile("src/features/play/WildzMinimap.tsx", "utf8");
    const controls = await readFile("src/features/play/WildzSocialDeck.tsx", "utf8");
    const route = await readFile("app/api/wilds/atlas/route.ts", "utf8");

    assert.match(campaign, /className="wilds-utility-cluster"/);
    assert.match(campaign, /BEAT:STEP:PULSE/);
    assert.match(campaign, /className="wilds-kai-command-pill"/);
    assert.match(campaign, /setRequestedCommand\("commandCenter"\)/);
    assert.match(campaign, /onOpenMap=\{\(\) => setMapOpen\(true\)\}/);
    assert.match(referenceHud, /<WildzMinimap[\s\S]*onOpen=\{onOpenMap\}/);
    assert.match(minimap, /<button[\s\S]*aria-label=\{`Open world map\./);
    assert.match(campaign, /<WildsWorldMap/);
    assert.doesNotMatch(campaign, /WildsWorldControls/);
    assert.match(campaign, /<WildzSocialDeck/);
    assert.match(campaign, /fetch\("\/api\/wilds\/rift"/);
    assert.match(campaign, /type: "apply-rift-grant"/);
    assert.doesNotMatch(campaign, /requestedAt|appliedAt/);
    assert.match(campaign, /grant: result\.grant,[\s\S]*?playerId: result\.grant\.playerId/);
    assert.match(controls, /aria-label=\{movementMode === "walk" \? "Switch to running" : "Switch to walking"\}/);
    assert.match(controls, /<WildzContextButton action=\{action\}/);
    assert.match(controls, /<WildzDpad cameraHeadingRef=\{cameraHeadingRef\} movementMode=\{movementMode\} onInput=\{onInput\}/);
    assert.match(route, /getWildsAtlasPresence/);
    assert.match(route, /cache-control": "private, no-store"/);
    assert.doesNotMatch(route, /activeCard/);
  });

  it("opens three full-screen proof-pinned landmark experiences", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const experience = await readFile("src/features/play/WildsLandmarkExperience.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");

    assert.match(campaign, /<WildsLandmarkExperience/);
    assert.match(experience, /role="dialog"/);
    assert.match(experience, /createPortal/);
    assert.match(experience, /aria-label="Return to world"/);
    assert.match(experience, /HearttreeRuntimeExperience/);
    assert.match(experience, /createArenaMatch/);
    assert.match(experience, /createPrismRun/);
    assert.match(experience, /Arena of Echoes duel/);
    assert.match(experience, /Prism Arcade cooperative run/);
    assert.match(experience, /wilds-landmark-gate/);
    assert.match(experience, /access\?\.summary/);
    assert.doesNotMatch(campaign, /WILDS_ACHIEVEMENTS_KEY|WILDS_TRAIL_PACK_KEY|WILDS_AVATAR_KEY|WILDS_MOVEMENT_MODE_KEY/);
    assert.match(campaign, /evaluateLandmarkAccess/);
    assert.match(campaign, /Inspect sealed/);
    assert.match(experience, /card\.proof\.digest/);
    assert.match(css, /\.wilds-landmark-experience\s*\{[^}]*position:\s*fixed;[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.wilds-arena-world/);
    assert.match(css, /\.wilds-prism-world/);
  });

  it("layers an authored biome around meaningful landmarks", async () => {
    const environment = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");

    assert.match(environment, /name="world-layer-play"/);
    assert.match(environment, /function GroundField/);
    assert.match(environment, /name="world-layer-mid"/);
    assert.match(environment, /name="world-layer-far"/);
    assert.match(environment, /function HearttreeSanctum/);
    assert.match(environment, /function FlagshipLandmarkEntrances/);
    assert.match(environment, /function ArenaOfEchoes/);
    assert.match(environment, /function PrismArcade/);
    assert.match(environment, /name="world-flagship-landmarks"/);
    assert.match(environment, /projectVisibleLandmarkEntrances\(player\)/);
    assert.match(environment, /function RootArch/);
    assert.match(environment, /<mesh position=\{\[0, 1\.14, 0\]\}>/);
    assert.match(environment, /function SpringLandmark/);
    assert.match(environment, /const springStones = useRef<THREE\.InstancedMesh>/);
    assert.match(environment, /const farCanopyMesh = useRef<THREE\.InstancedMesh>/);
    assert.match(environment, /args=\{\[undefined, undefined, silhouettes\.length\]\}/);
    assert.match(environment, /instancedMesh/);
    assert.match(world, /<WildsEnvironment/);
  });

  it("builds the explorer from articulated anatomy and secondary motion", async () => {
    const explorer = await readFile("src/features/play/WildsExplorer.tsx", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");

    for (const joint of ["hips", "spine", "leftElbow", "rightElbow", "leftKnee", "rightKnee", "satchel", "scarf"]) {
      assert.match(explorer, new RegExp(joint));
    }
    assert.match(explorer, /movingUntil/);
    assert.match(explorer, /breath/);
    assert.match(explorer, /footPlant/);
    assert.match(world, /<WildsExplorer/);
    assert.match(explorer, /name="hips" position=\{\[0, 0\.72, 0\]\}/);
    assert.match(explorer, /hips\.current\.position\.y = 0\.72 \+ footPlant \* 0\.012/);
    assert.match(explorer, /position=\{\[side \* 0\.12, -0\.06, 0\]\} ref=\{knee\}/);
    assert.match(explorer, /length=\{0\.34\} radius=\{0\.08\}/);
    assert.doesNotMatch(explorer, /"leftLeg"/);
    assert.doesNotMatch(explorer, /name="bootSole"/);
    assert.match(explorer, /name="rearHair"/);
    assert.match(explorer, /name="leftEar"/);
    assert.match(explorer, /name="rightEar"/);
  });

  it("adds deterministic canopy atmosphere and proximity motion", async () => {
    const atmosphere = await readFile("src/features/play/WildsAtmosphere.tsx", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");

    assert.match(atmosphere, /function SunShafts/);
    assert.match(atmosphere, /function PollenDrift/);
    assert.match(atmosphere, /function CanopyShadows/);
    assert.match(atmosphere, /foliage-surge/);
    assert.match(world, /<WildsAtmosphere/);
  });

  it("avoids competing float transforms and unstable contact shadows", async () => {
    const source = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");

    assert.doesNotMatch(source, /\bFloat\b/);
    assert.doesNotMatch(source, /ContactShadows/);
    assert.doesNotMatch(source, /preserveDrawingBuffer/);
    assert.doesNotMatch(source, /<planeGeometry args=\{\[1\.05, 9\.6\]\}/);
    assert.doesNotMatch(source, /tubeGeometry/);
    assert.match(source, /StreamedTerrain/);
  });

  it("exposes renderer and game-state diagnostics for release profiling", async () => {
    const source = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");

    assert.match(source, /__THREE_GAME_DIAGNOSTICS__/);
    assert.match(source, /renderer:\s*gl\.info/);
  });

  it("uses a warning-free quality profile and publishes budget status", async () => {
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as { dependencies: Record<string, string> };

    assert.equal(pkg.dependencies.three, "0.182.0");
    assert.doesNotMatch(world, /\n\s*shadows\s*\n/);
    assert.match(world, /shadows=\{\{ type: THREE\.PCFShadowMap \}\}/);
    assert.match(world, /qualityProfile\.dpr/);
    assert.match(world, /rendererBudgetStatus/);
    assert.match(world, /warningFreeCompatibility/);
  });

  it("gives the four companions distinct authored silhouettes", async () => {
    const source = await readFile("src/features/play/WildsCreatureActor.tsx", "utf8");

    assert.match(source, /function CreatureIdentityDetail/);
    for (const id of ["mintcub", "voltray", "ledgerfox", "titanseal"]) {
      assert.match(source, new RegExp(`familyId === ["']${id}["']`));
    }
  });

  it("renders genome-driven creature actors with emotional battle poses", async () => {
    const actor = await readFile("src/features/play/WildsCreatureActor.tsx", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    for (const pose of ["idle", "curious", "attack", "impact", "weakened", "capture"]) {
      assert.match(actor, new RegExp(`"${pose}"`));
    }
    for (const body of ["round", "long", "armored", "winged", "serpentine"]) {
      assert.match(actor, new RegExp(`body === "${body}"`));
    }
    assert.match(actor, /wilds-creature-face/);
    assert.match(actor, /wilds-creature-limbs/);
    assert.match(actor, /useFrame/);
    assert.match(world, /<WildsCreatureActor/);
  });

  it("keeps compact controls below the world and opens strategy from one icon dock", async () => {
    const source = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const controls = await readFile("src/features/play/WildzSocialDeck.tsx", "utf8");
    const creatureDrawer = await readFile("src/features/play/WildzCreatureDrawer.tsx", "utf8").catch(() => "");
    const commandDock = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");
    const stageEnd = source.indexOf("<WildzSocialDeck");
    const eventToast = source.indexOf('<div className="wilds-event-toast"');

    assert.ok(stageEnd > eventToast);
    assert.match(source, /<WildsCommandDock items=\{commandItems\}/);
    for (const key of ["mission", "fieldGuide", "satchel", "deck", "vault"]) assert.match(source, new RegExp(`key: "${key}"`));
    assert.match(source, /badge: `\$\{state\.missionProgress\}%`/);
    assert.match(source, /badge: `\$\{discoveredByFamily\.size\}\/\$\{creatureFamilies\.length\}`/);
    assert.match(source, /badge: state\.beans/);
    assert.match(source, /badge: state\.inventory\.length/);
    assert.doesNotMatch(source, /<details className="wilds-mission-card">/);
    assert.doesNotMatch(source, /<details className="wilds-command-tray/);
    assert.doesNotMatch(source, /<details className="wilds-inventory-tray">/);
    assert.match(source, /Portable card vault/);
    assert.match(source, /type: "select-asset"/);
    assert.match(source, /<WildsInventory/);
    assert.match(controls, /<WildzCreatureDrawer/);
    assert.doesNotMatch(controls, /sortedCards\.map/);
    assert.doesNotMatch(creatureDrawer, /WildsInventory|cameraHeading|movementMode|playerPosition/);
    assert.match(commandDock, /activeItem\s*\?[\s\S]*?activeItem\.content/);
    assert.match(controls, /aria-label="Make camp and recover"/);
    assert.match(controls, /aria-label="Run world mission"/);
    assert.match(css, /\.mobile-play-wrap \.wilds-stage\s*\{[^}]*min-height:\s*0/);
    assert.doesNotMatch(css, /\.mobile-play-wrap \.wilds-stage\s*\{[^}]*min-height: 286px/);
    assert.match(source, /wilds-coordinate-badges/);
    assert.match(controls, /Discovery active/);
    assert.doesNotMatch(source, /setSearchArmed\(false\)/);
    assert.match(source, /state\.encounter\.proximity/);
  });

  it("centers the movement pad between two perfectly balanced three-action rails", async () => {
    const controls = await readFile("src/features/play/WildzSocialDeck.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");

    assert.equal(controls.match(/className="wildz-play-control-rail"/g)?.length, 2);
    assert.match(controls, /<WildzDpad/);
    assert.match(css, /\.wildz-bottom-play-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 72px minmax\(0, 1fr\)/s);
    assert.match(css, /\.wildz-play-control-rail\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  });

  it("surfaces endless chapter equity and deterministic world events", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const environment = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");
    assert.match(campaign, /projectWorldProgression/);
    assert.match(campaign, /wilds-world-chapter/);
    assert.match(campaign, /Permanent mastery/);
    assert.match(environment, /worldMastery/);
  });

  it("uses a drag trackpad and streams terrain around the player", async () => {
    const controls = await readFile("src/features/play/WildzDpad.tsx", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const environment = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");

    assert.match(controls, /function WildzDpad/);
    assert.match(controls, /setPointerCapture/);
    assert.match(controls, /move-vector/);
    assert.match(world, /function StreamedTerrain/);
    assert.match(environment, /WILDS_TILE_SIZE/);
  });

  it("keeps mobile movement aligned while players orbit and pinch the gameplay camera", async () => {
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const controls = await readFile("src/features/play/WildzDpad.tsx", "utf8");

    assert.match(world, /OrbitControls/);
    assert.match(world, /enableDamping/);
    assert.match(world, /enablePan=\{false\}/);
    assert.match(world, /minDistance=\{4\.8\}/);
    assert.match(world, /maxDistance=\{13\.5\}/);
    assert.match(world, /minPolarAngle=\{(?:0)?\.38\}/);
    assert.match(world, /maxPolarAngle=\{Math\.PI \/ 2\.15\}/);
    assert.match(world, /touches=\{\{ ONE: THREE\.TOUCH\.ROTATE, TWO: THREE\.TOUCH\.DOLLY_ROTATE \}\}/);
    assert.match(world, /onCameraHeadingChange/);
    assert.match(campaign, /cameraHeadingRef/);
    assert.doesNotMatch(campaign, /useState\(0\).*cameraHeading/);
    assert.match(controls, /cameraRelativeMovement\(next, cameraHeadingRef\.current\)/);
    assert.doesNotMatch(world, /camera\.position\.lerp\(target/);
  });

  it("prevents accidental selection and long-press callouts across the gameplay surface", async () => {
    const css = await readFile("app/globals.css", "utf8");

    assert.match(css, /\.wilds-play-panel[\s\S]*?-webkit-touch-callout:\s*none/);
    assert.match(css, /\.wilds-play-panel[\s\S]*?-webkit-user-select:\s*none/);
    assert.match(css, /\.wilds-play-panel[\s\S]*?user-select:\s*none/);
  });

  it("renders an accessible Receiz Capsule reward and bounded card inventory", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const reward = await readFile("src/features/play/WildsCaptureReward.tsx", "utf8");
    const inventory = await readFile("src/features/play/WildsInventory.tsx", "utf8");
    const card = await readFile("src/features/play/WildsCard.tsx", "utf8");
    const cardExport = await readFile("src/features/play/card-export.ts", "utf8");
    const css = await readFile("app/globals.css", "utf8");
    const growth = await readFile("src/features/play/WildsGrowthPanel.tsx", "utf8");
    const transformation = await readFile("src/features/play/WildsTransformation.tsx", "utf8");
    const ceremony = await readFile("src/features/play/WildsChildCeremony.tsx", "utf8");

    assert.match(campaign, /type: "search-point"/);
    assert.match(campaign, /type: "advance-encounter"/);
    assert.match(campaign, /WildsCaptureReward/);
    assert.match(campaign, /WildsInventory/);
    assert.match(campaign, /useState\(\(\) => initialState\)/);
    assert.match(campaign, /onPlayStateChange\(state,\s*\{/);
    assert.doesNotMatch(campaign, /WILDS_SAVE_KEY|localStorage\.setItem\([^,]*wilds:save/);
    assert.match(reward, /role="dialog"/);
    assert.match(reward, /aria-live="assertive"/);
    assert.match(reward, /wilds-capture-capsule/);
    assert.match(reward, /wilds-capture-showcase/);
    assert.doesNotMatch(reward, /<WildsCard asset=\{asset\} compact/);
    assert.match(inventory, /type="search"/);
    assert.match(inventory, /inventoryPageSize/);
    assert.match(inventory, /wilds-inventory-page/);
    assert.match(inventory, /onPointerDown=/);
    assert.match(inventory, /onPointerCancel=/);
    assert.match(inventory, /onLostPointerCapture=/);
    assert.match(inventory, /wilds-vault-page-dots/);
    assert.match(inventory, /downloadPortableCard/);
    assert.match(inventory, /Set as active deck leader/);
    assert.match(inventory, /type: "select-asset"/);
    assert.match(inventory, /type: "evolve"/);
    assert.match(card, /wilds-card-foil/);
    assert.match(card, /renderHeartboundSvg/);
    assert.match(card, /fit:\s*"full-body"/);
    assert.match(cardExport, /renderHeartboundSvg/);
    assert.match(growth, /What remains/);
    assert.match(growth, /Revision history/);
    assert.match(transformation, /aria-label="Living card transformation"/);
    assert.match(transformation, /aria-live="assertive"/);
    assert.match(ceremony, /Both parents remain yours/);
    assert.match(ceremony, /aria-label="Living child ceremony"/);
    assert.match(inventory, /WildsGrowthPanel/);
    assert.match(campaign, /WildsTransformation/);
    assert.match(campaign, /WildsChildCeremony/);
    assert.doesNotMatch(card, /wilds-card-creature-core/);
    assert.doesNotMatch(cardExport, /function creatureMark/);
    assert.match(css, /\.heartbound-card-art\s*>\s*svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*max-width:\s*100%;/s);
    assert.match(css, /\.wilds-command-dock\s*\{[^}]*grid-template-columns:\s*repeat\(4/s);
    assert.doesNotMatch(css, /\.mobile-play-wrap \.wilds-command-system\s*\{[^}]*position:\s*fixed/s);
    assert.match(css, /\.mobile-play-wrap \.wilds-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;[^}]*height:\s*100%/s);
    assert.match(css, /\.mobile-play-wrap \.wilds-world\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) 68px/s);
    assert.match(css, /\.wilds-command-badge/);
    assert.match(css, /\.wilds-command-sheet\s*\{[^}]*position:\s*absolute/s);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /\.wilds-vault-page-dots/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /\.heartbound-card-art\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10;/s);
    assert.match(css, /\.wilds-capture-showcase\s*\{[^}]*isolation:\s*isolate/s);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-capture-capsule/);
  });

  it("renders a complete living character back with exact proof controls", async () => {
    const cardBack = await readFile("src/features/play/WildsCardBack.tsx", "utf8");

    assert.match(cardBack, /aria-label="Living card back"/);
    assert.match(cardBack, /Character story/);
    assert.match(cardBack, /Personality/);
    assert.match(cardBack, /Gameplay intelligence/);
    assert.match(cardBack, /Full visual DNA/);
    assert.match(cardBack, /Complete offline proof/);
    assert.match(cardBack, /Copy canonical proof/);
    assert.match(cardBack, /Download canonical proof/);
    assert.match(cardBack, /Generate exact PNG proof metadata/);
    assert.match(cardBack, /aria-live="polite"/);
  });

  it("resolves public cards across devices and physically flips the complete card", async () => {
    const page = await readFile("src/features/play/WildsCardPage.tsx", "utf8");
    const scene = await readFile("src/features/play/WildsCardScene.tsx", "utf8");
    const cardExport = await readFile("src/features/play/card-export.ts", "utf8");
    const cardRoute = await readFile("app/api/cards/[assetId]/route.ts", "utf8");
    const inventory = await readFile("src/features/play/WildsInventory.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");

    assert.match(page, /fetch\(`\/api\/cards\/\$\{encodeURIComponent\(assetId\)\}`/);
    assert.doesNotMatch(page, /not found locally/i);
    assert.match(scene, /WildsCardBack/);
    assert.match(scene, /wilds-card-flipper/);
    assert.match(scene, /onPointerDown/);
    assert.match(scene, /onPointerUp/);
    assert.match(scene, /Math\.abs\(deltaX\) >= 28/);
    assert.match(scene, /event\.key === "Enter" \|\| event\.key === " "/);
    assert.match(scene, /aria-hidden=\{flipped\}/);
    assert.match(scene, /aria-hidden=\{!flipped\}/);
    assert.doesNotMatch(scene, /wilds-card-flip-control/);
    assert.doesNotMatch(css, /\.wilds-card-flip-control/);
    assert.match(cardExport, /attemptPublicWildsCardRegistration/);
    assert.doesNotMatch(cardExport, /BROWSER_RECEIZ_ID_SESSION_KEY|keyFile|passphrase/);
    assert.match(cardRoute, /resolveWildzCookieActor/);
    assert.match(cardRoute, /createReceizWildzPublicRepository/);
    assert.match(cardRoute, /repository\.publish/);
    assert.match(cardRoute, /status:\s*503/);
    assert.doesNotMatch(cardRoute, /publishPublicStoreWithIdentityProof|hasPublicationAuthority|published:\s*false/);
    assert.match(inventory, /Publishing verified card link/);
    assert.match(inventory, /Portable PNG downloaded/);
    assert.match(inventory, /Portable PNG downloaded and verifies offline/);
    assert.match(cardExport, /premiumQrSvg\(cardPath/);
    assert.match(cardExport, /attemptPublicWildsCardRegistration/);
    assert.match(cardExport, /attemptPublicWildsCardRegistration\(asset\)/);
    assert.match(cardExport, /errorCorrectionLevel:\s*"L"/);
    assert.match(css, /backface-visibility:\s*hidden/);
    assert.match(css, /-webkit-backface-visibility:\s*hidden/);
    assert.match(css, /\.wilds-card-face-back\s*\{[^}]*opacity:\s*0/);
    assert.match(css, /\.wilds-card-flipper\.is-flipped\s+\.wilds-card-face-back\s*\{[^}]*opacity:\s*1/);
    assert.match(css, /\.wilds-collectible-card\s*\{[^}]*overflow:\s*hidden/);
    assert.match(css, /\.wilds-card-face-front\s*\{[^}]*transform:\s*translateZ\(0\.1px\)/);
    assert.doesNotMatch(css, /\.wilds-collectible-card\s*\{[^}]*clip-path:/);
    assert.doesNotMatch(css, /\.wilds-card-foil\s*\{[^}]*inset:\s*-35%/s);
    assert.match(campaign, /\{deckCards\.length\}\/∞/);
  });

  it("restores the complete vault inside a scrollable mobile command sheet", async () => {
    const inventory = await readFile("src/features/play/WildsInventory.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");

    assert.match(inventory, /import QRCode from "qrcode"/);
    assert.match(inventory, /standaloneCardUrl/);
    assert.match(inventory, /<WildsCardScene asset=\{selected\} origin=\{origin\} qr=\{qr\}/);
    assert.match(inventory, />Import card or vault</);
    assert.match(inventory, />Save vault image</);
    assert.match(inventory, />Save card image</);
    assert.match(inventory, /aria-label="Import card or vault"/);
    assert.match(inventory, /aria-label="Save vault image"/);
    assert.match(inventory, /aria-busy=\{vaultSaving\}/);
    assert.match(inventory, /aria-busy=\{cardSaving\}/);
    assert.match(inventory, /wilds-action-busy/);
    assert.match(inventory, /aria-label="Fuse cards"/);
    assert.match(inventory, /setVaultMessage/);
    assert.match(inventory, /type: "fuse-cards"/);
    assert.match(inventory, /WildsGrowthPanel/);
    assert.match(inventory, /type: "evolve"/);
    assert.match(inventory, /Verify \+ list on Exchange/);
    assert.doesNotMatch(inventory, /<WildsCard asset=\{selected\}/);
    assert.doesNotMatch(css, /\.wilds-command-sheet-content \.wilds-inventory > header \{ display: none; \}/);
    assert.match(css, /\.wilds-command-sheet\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/s);
    assert.match(css, /\.wilds-command-sheet-content\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.wilds-command-sheet-content \.wilds-vault-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4, 40px\)[^}]*justify-content:\s*end/s);
    assert.match(css, /\.wilds-command-sheet-content \.wilds-import-card\s*\{[^}]*width:\s*40px[^}]*min-height:\s*44px/s);
    assert.match(css, /\.wilds-command-sheet-content \.wilds-import-card::before\s*\{[^}]*inset:\s*4px/s);
    assert.doesNotMatch(css, /\.wilds-command-sheet-content \.wilds-inventory > header \.wilds-import-card\s*\{[^}]*width:\s*100%/s);
    assert.match(css, /\.wilds-command-sheet-content \.wilds-import-card span\s*\{[^}]*display:\s*none/s);
    assert.match(css, /\.wilds-inventory-detail \.wilds-card-scene\s*\{[^}]*aspect-ratio:\s*5\s*\/\s*7/s);
    assert.match(css, /\.wilds-action-feedback:active/);
    assert.match(css, /\.wilds-action-feedback\.wilds-action-busy/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /\.mobile-play-wrap \.wilds-command-sheet\s*\{[^}]*top:\s*calc\(52px \+ env\(safe-area-inset-top\)\)[^}]*max-height:\s*none/s);
  });

  it("keeps creatures hidden until an exact terrain search reveals one", async () => {
    const state = await readFile("src/features/play/game-state.ts", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const environment = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const battle = await readFile("src/features/play/WildsBattle.tsx", "utf8");

    assert.match(state, /searchHiddenHotspots/);
    assert.match(world, /function SearchableTerrain/);
    assert.match(environment, /function EcologyInstances/);
    assert.match(environment, /<EcologyInstances/);
    assert.match(world, /<WildsExplorer/);
    assert.match(environment, /projectWildsBiome/);
    assert.match(campaign, /Choose your explorer/);
    assert.match(campaign, /Female explorer/);
    assert.match(campaign, /Male explorer/);
    assert.match(campaign, /<WildsBattle/);
    assert.match(battle, /wilds-battle-turn/);
    assert.match(battle, /wilds-battle-intent/);
    assert.match(battle, /wilds-battle-condition/);
    assert.match(battle, /type: "focus"/);
    assert.match(battle, /aria-label="Capture weakened creature"/);
    assert.match(battle, /Switch active card/);
    assert.match(battle, /battle\.wild\.hpRatio > 0\.3/);
    assert.match(world, /function EncounterSequence/);
    assert.match(world, /const encounter = state\.encounter/);
    assert.doesNotMatch(world, /nearbyCreatureCards\(state\.player\)/);
    assert.doesNotMatch(world, /\{creatureCards\.map/);
    assert.doesNotMatch(world, /habitatNodes\.map/);
    assert.match(world, /function RustlingClue/);
    assert.match(world, /encounter\.proximity === "hot"/);
    assert.match(world, /HabitatCover cover=\{encounter\.cover/);
    assert.match(campaign, /signal-\$\{state\.encounter\.proximity\}/);
  });

  it("anchors compact battle health to both combatants above the gameplay HUD", async () => {
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const battle = await readFile("src/features/play/WildsBattle.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");

    assert.match(world, /function BattleWorldTelemetry/);
    assert.match(world, /fighter=\{state\.battle\.player\}/);
    assert.match(world, /fighter=\{state\.battle\.wild\}/);
    assert.match(world, /function isBattleTelemetryPhase/);
    assert.equal((world.match(/state\.battle && isBattleTelemetryPhase\(state\.encounter\.phase\)/g) ?? []).length, 2);
    assert.match(world, /zIndexRange=\{\[64, 56\]\}/);
    assert.match(world, /role="meter"/);
    assert.match(world, /aria-label=\{`\$\{fighter\.name\} health \$\{fighter\.hp\} of \$\{fighter\.maxHp\}`\}/);
    assert.match(css, /\.wilds-battle-world-stat\s*\{[^}]*width:\s*clamp\(88px,\s*14vw,\s*118px\)[^}]*pointer-events:\s*none/s);
    assert.match(css, /\.wilds-battle-world-stat-meter\s*\{[^}]*height:\s*3px[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.wilds-battle-world-stat\.capture-ready/);
    assert.doesNotMatch(battle, /function HealthBar/);
  });

  it("renders the SDK-native live multiplayer loop inside the shared world", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const multiplayer = await readFile("src/features/play/WildsMultiplayer.tsx", "utf8");
    const hook = await readFile("src/features/play/use-wilds-multiplayer.ts", "utf8");
    const styles = await readFile("app/globals.css", "utf8");

    assert.match(campaign, /useWildsMultiplayer/);
    assert.match(campaign, /remotePlayers=\{multiplayer\.remotePlayers\}/);
    assert.match(campaign, /multiplayer\.activeBattle \? " pvp-active"/);
    assert.match(world, /function RemoteExplorer/);
    assert.match(world, /onSelectPlayer/);
    assert.match(world, /zIndexRange=\{\[12, 0\]\}/);
    assert.match(multiplayer, /Copy invite link/);
    assert.doesNotMatch(multiplayer, />PRACTICE</);
    assert.match(multiplayer, /viewBox="0 0 24 24"/);
    assert.doesNotMatch(multiplayer, /className="sr-only">Copy invite link/);
    assert.match(multiplayer, /window\.setTimeout\(\(\) => setNotice\(""\), 2_800\)/);
    assert.doesNotMatch(styles, /content: "↗"/);
    assert.match(styles, /\.wilds-live-badge, \.wilds-live-share \{ min-height: 30px/);
    assert.match(styles, /\.wilds-live-share \{[\s\S]*?width: 30px/);
    assert.match(multiplayer, /Friendly battle/);
    assert.match(multiplayer, /Return to world/);
    assert.match(hook, /dismissBattle/);
    assert.match(multiplayer, /Card stake/);
    assert.match(multiplayer, /Compliance locked/);
    assert.match(hook, /\/api\/wilds\/multiplayer\/session/);
    assert.match(hook, /\/api\/wilds\/multiplayer\/snapshot/);
    assert.match(hook, /wildsJoin/);
  });

  it("keeps animated card foil inside rounded inventory corners", async () => {
    const styles = await readFile("app/globals.css", "utf8");

    assert.match(styles, /--card-border: 8px/);
    assert.match(styles, /\.wilds-card-foil \{[\s\S]*?z-index: 0;/);
    assert.match(styles, /background-clip: padding-box/);
    assert.match(styles, /backface-visibility: hidden/);
    assert.match(styles, /\.wilds-collectible-card > :not\(\.wilds-card-foil\)/);
  });

  it("uses Next navigation for every internal standalone-card action", async () => {
    const source = await readFile("src/features/play/WildsCardPage.tsx", "utf8");

    assert.match(source, /import Link from "next\/link"/);
    assert.doesNotMatch(source, /<a\s+[^>]*href=\{?[`"]\/?/);
    assert.match(source, /<Link className="wilds-card-home" href="\/#play">/);
    assert.match(source, /<Link href=\{`\/?\?card=/);
  });

  it("keeps verified card and vault PNG recovery inside the game kernel", async () => {
    const cardExport = await readFile("src/features/play/card-export.ts", "utf8");

    assert.match(cardExport, /verifyPortableCardPng/);
    assert.match(cardExport, /verifyPortableVaultPng/);
    assert.match(cardExport, /readPortableCardFromPng/);
    assert.match(cardExport, /readPortableVaultFromPng/);
    assert.doesNotMatch(cardExport, /ProductEditorPanel|shop products/);
  });

  it("integrates a gesture-safe audio lifecycle and accessible settings", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const hook = await readFile("src/features/play/use-wilds-presentation.ts", "utf8");
    const controls = await readFile("src/features/play/WildsAudioSettings.tsx", "utf8");

    assert.match(campaign, /useWildsPresentation/);
    assert.match(campaign, /<WildsAudioSettings/);
    assert.match(hook, /pointerdown/);
    assert.match(hook, /runtime\.destroy\(\)/);
    assert.match(controls, /aria-label="Wilds audio settings"/);
    assert.match(controls, /Master volume/);
    assert.match(controls, /Effects volume/);
    assert.match(controls, /Ambience volume/);
    assert.match(controls, /Music volume/);
    assert.match(controls, /Mute Wilds audio/);
    assert.match(campaign, /wilds-utility-cluster/);
    const socialDeck = campaign.slice(campaign.indexOf("<WildzSocialDeck"));
    assert.doesNotMatch(socialDeck, /<WildsAudioSettings/);
  });
});
