"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  creatureCards,
  selectedCard,
  type CreatureCard,
  type PlayState
} from "@/features/play/game-state";
import { creatureForm } from "@/features/play/creature-catalog";
import type { BattleFighter } from "@/features/play/battle-engine";
import type { HotspotCover } from "@/features/play/hidden-hotspots";
import type { WildsPresence } from "@/features/play/multiplayer-core";
import { WildsEnvironment } from "@/features/play/WildsEnvironment";
import { WildsExplorer } from "@/features/play/WildsExplorer";
import { WildsAtmosphere } from "@/features/play/WildsAtmosphere";
import { WildsCreatureActor, type WildsCreaturePose } from "@/features/play/WildsCreatureActor";
import { projectWorldProgression } from "@/features/play/world-progression";
import {
  rendererBudgetStatus,
  type WildsQualityProfile
} from "@/features/play/wilds-quality-profile";
import type { WildsWorldProjection } from "@/features/play/wilds-world-state";
import type { WildsSettlementWorldMode } from "@/features/play/WildsSettlementEnvironment";
import { WildsEcologyEnvironment } from "@/features/play/WildsEcologyEnvironment";
import { WildsBossEnvironment } from "@/features/play/WildsBossEnvironment";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { KaiKlokMoment } from "@/features/play/kai-klok-moment";
import { projectKaiWorldExpression } from "@/features/play/kai-moment-expression";
import { WildsKaiAtmosphereGeometry } from "@/features/play/WildsKaiAtmosphereGeometry";
import { projectCardKaiAppearance } from "@/features/play/card-kai-appearance";
import type { WildsTrainerProjection } from "@/features/play/wilds-saga-trainers";

export function WildsWorldCanvas({
  state,
  avatarStyle,
  remotePlayers,
  qualityProfile,
  searchEnabled,
  onCameraHeadingChange,
  onSelectPlayer,
  onSelectTrainer,
  onSearchPoint,
  livingWorld,
  worldMode,
  kaiMoment,
  supportCards = [],
  trainers = []
}: {
  state: PlayState;
  avatarStyle: "female" | "male";
  remotePlayers: WildsPresence[];
  qualityProfile: WildsQualityProfile;
  searchEnabled: boolean;
  onCameraHeadingChange: (heading: number) => void;
  onSelectPlayer: (player: WildsPresence | null) => void;
  onSearchPoint: (point: { x: number; z: number }) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  kaiMoment: KaiKlokMoment;
  supportCards?: readonly PortableCardAsset[];
  trainers?: readonly WildsTrainerProjection[];
  onSelectTrainer: (trainer: WildsTrainerProjection) => void;
}) {
  return (
    <div
      className={`wilds-canvas-wrap${searchEnabled ? " search-armed" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 80, position: [4.6, 5.8, 7.2] }}
        dpr={qualityProfile.dpr}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl, size }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          publishWildsDiagnostics(gl, size, state, qualityProfile);
        }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        <Suspense fallback={null}>
          <WildsScene state={state} avatarStyle={avatarStyle} remotePlayers={remotePlayers} qualityProfile={qualityProfile} searchEnabled={searchEnabled} onCameraHeadingChange={onCameraHeadingChange} onSelectPlayer={onSelectPlayer} onSelectTrainer={onSelectTrainer} onSearchPoint={onSearchPoint} livingWorld={livingWorld} worldMode={worldMode} kaiMoment={kaiMoment} supportCards={supportCards} trainers={trainers} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function WildsScene({
  state,
  avatarStyle,
  remotePlayers,
  qualityProfile,
  searchEnabled,
  onCameraHeadingChange,
  onSelectPlayer,
  onSearchPoint,
  livingWorld,
  worldMode,
  kaiMoment,
  supportCards,
  trainers,
  onSelectTrainer
}: {
  state: PlayState;
  avatarStyle: "female" | "male";
  remotePlayers: WildsPresence[];
  qualityProfile: WildsQualityProfile;
  searchEnabled: boolean;
  onCameraHeadingChange: (heading: number) => void;
  onSelectPlayer: (player: WildsPresence | null) => void;
  onSearchPoint: (point: { x: number; z: number }) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  kaiMoment: KaiKlokMoment;
  supportCards: readonly PortableCardAsset[];
  trainers: readonly WildsTrainerProjection[];
  onSelectTrainer: (trainer: WildsTrainerProjection) => void;
}) {
  const world = projectWorldProgression(state.worldMastery);
  const kaiExpression = projectKaiWorldExpression(kaiMoment);
  const kaiFog = useMemo(() => new THREE.Color(world.chapter.palette.fog)
    .lerp(new THREE.Color(kaiExpression.sky.tint), 0.22 * kaiExpression.sky.luminance)
    .lerp(new THREE.Color(kaiExpression.accent), kaiExpression.atmosphericInfluence)
    .getStyle(), [kaiExpression.accent, kaiExpression.atmosphericInfluence, kaiExpression.sky.luminance, kaiExpression.sky.tint, world.chapter.palette.fog]);
  const worldSparkleCount = Math.round(54 * qualityProfile.particles);
  return (
    <>
      <color attach="background" args={[kaiFog]} />
      <fog attach="fog" args={[kaiFog, 8 + kaiExpression.sky.luminance * 3, 21 + (1 - kaiExpression.sky.fogDensity) * 4]} />
      <WildsAtmosphere encounter={state.encounter} expression={kaiExpression} missionProgress={state.missionProgress} player={state.player} qualityProfile={qualityProfile} />
      <WildsKaiAtmosphereGeometry expression={kaiExpression} qualityProfile={qualityProfile} />
      <CameraRig onCameraHeadingChange={onCameraHeadingChange} />
      <WildsDiagnostics qualityProfile={qualityProfile} state={state} />
      <SmoothWorldFrame player={state.player}>
        <SearchableTerrain
          enabled={searchEnabled}
          missionProgress={state.missionProgress}
          onSearchPoint={onSearchPoint}
          player={state.player}
          qualityProfile={qualityProfile}
          worldMastery={state.worldMastery}
          livingWorld={livingWorld}
          worldMode={worldMode}
        />
        <WildsEcologyEnvironment livingWorld={livingWorld} player={state.player} worldMode={worldMode} />
        <WildsBossEnvironment livingWorld={livingWorld} player={state.player} qualityProfile={qualityProfile} />
        <EncounterSequence state={state} />
        {remotePlayers.map((player) => <RemoteExplorer key={player.playerId} player={player} localPlayer={state.player} onSelect={onSelectPlayer} />)}
        {trainers.map((trainer) => <TrainerExplorer key={trainer.id} trainer={trainer} localPlayer={state.player} onSelect={onSelectTrainer} />)}
      </SmoothWorldFrame>
      <WildsExplorer style={avatarStyle} worldPosition={state.player} />
      <ActiveCompanion state={state} />
      <SupportCompanions cards={supportCards} />
      <Sparkles key={`wilds-world-sparkles-${worldSparkleCount}`} count={worldSparkleCount} scale={[8, 2.4, 8]} size={2.1} speed={kaiExpression.particleSpeed} color={kaiExpression.accent} />
    </>
  );
}

function SmoothWorldFrame({ player, children }: { player: PlayState["player"]; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const previous = useRef(player);
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = player;
    if (!group.current) return;
    group.current.position.x += player.x - prior.x;
    group.current.position.z += player.z - prior.z;
  }, [player]);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, 0, 18, delta);
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, 0, 18, delta);
  });
  return <group ref={group}>{children}</group>;
}

function TrainerExplorer({ trainer, localPlayer, onSelect }: {
  trainer: WildsTrainerProjection;
  localPlayer: PlayState["player"];
  onSelect: (trainer: WildsTrainerProjection) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const style = trainer.seed % 2 ? "female" as const : "male" as const;
  useFrame(({ clock }) => {
    if (!group.current) return;
    const phase = clock.elapsedTime * (0.18 + trainer.seed % 5 * 0.015) + trainer.seed % 97;
    group.current.position.set(
      trainer.position[0] - localPlayer.x + Math.sin(phase) * 0.7,
      0,
      trainer.position[2] - localPlayer.z + Math.cos(phase * 0.83) * 0.7
    );
    group.current.rotation.y = -phase;
  });
  const rosterName = creatureForm(trainer.rosterFormIds[0])?.name ?? trainer.affinity;
  return <group
    name={`trainer-${trainer.id}`}
    onClick={(event) => { event.stopPropagation(); onSelect(trainer); }}
    position={[trainer.position[0] - localPlayer.x, 0, trainer.position[2] - localPlayer.z]}
    ref={group}
  >
    <WildsExplorer remote style={style} worldPosition={{ x: trainer.position[0], z: trainer.position[2] }} />
    <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.5, .045, 8, 32]} />
      <meshStandardMaterial color="#f7d25b" emissive="#c68f25" emissiveIntensity={.78} />
    </mesh>
    <Html center className="wilds-remote-nameplate wilds-trainer-nameplate" distanceFactor={8} position={[0, 1.48, 0]} zIndexRange={[14, 1]}>
      <span>{trainer.name}</span><small>Wild trainer · Lv. {trainer.challengeLevel} · {rosterName}</small>
    </Html>
  </group>;
}

function isBattleTelemetryPhase(phase: PlayState["encounter"]["phase"]) {
  return phase === "player_turn" || phase === "capture_ready" || phase === "fled" || phase === "defeated";
}

function ActiveCompanion({ state }: { state: PlayState }) {
  const card = selectedCard(state);
  const asset = state.inventory.find((candidate) => candidate.id === state.selectedAssetId);
  const formId = asset?.manifest.formId ?? `${card.id}-1`;
  const appearance = useMemo(() => asset ? projectCardKaiAppearance(asset) : null, [asset]);
  return (
    <group name="active-companion" position={[-1.08, 0.44, 0.42]} scale={0.82}>
      <WildsCreatureActor accent={appearance?.palette.accent ?? card.accent} cadenceMs={appearance?.cadenceMs} familyId={asset?.manifest.familyId ?? card.id} formId={formId} identityToken={appearance?.fingerprint} morphology={appearance?.morphology} pose="curious" primary={appearance?.palette.primary ?? card.color} />
      <mesh position={[0, -0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.035, 8, 36]} />
        <meshStandardMaterial color="#f4fff6" emissive="#7cdea5" emissiveIntensity={0.55} transparent opacity={0.92} />
      </mesh>
      {state.battle && isBattleTelemetryPhase(state.encounter.phase) ? (
        <BattleWorldTelemetry fighter={state.battle.player} position={[0, 1.9, 0]} side="player" />
      ) : (
        <Html center className="wilds-world-label" distanceFactor={8} position={[0, 0.96, 0]} zIndexRange={[10, 0]}>
          <span>{asset?.manifest.name ?? card.name}</span>
        </Html>
      )}
    </group>
  );
}

function SupportCompanions({ cards }: { cards: readonly PortableCardAsset[] }) {
  const positions: readonly [number, number, number][] = [[1.05, 0.34, 0.72], [1.62, 0.28, 1.34]];
  const appearances = useMemo(() => cards.slice(0, 2).map((card) => ({ card, appearance: projectCardKaiAppearance(card) })), [cards]);
  return <group name="trail-pack-support-companions">
    {appearances.map(({ card, appearance }, index) => <group key={card.id} name={`trail-support-${index + 1}`} position={positions[index]} scale={index === 0 ? 0.62 : 0.54}>
      <WildsCreatureActor
        accent={appearance.palette.accent}
        cadenceMs={appearance.cadenceMs}
        familyId={card.manifest.familyId}
        formId={card.manifest.formId}
        identityToken={appearance.fingerprint}
        morphology={appearance.morphology}
        pose={index === 0 ? "curious" : "idle"}
        primary={appearance.palette.primary}
      />
      <mesh position={[0, -0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.025, 8, 28]} />
        <meshStandardMaterial color="#dffcf0" emissive="#58c99d" emissiveIntensity={0.36} transparent opacity={0.72} />
      </mesh>
    </group>)}
  </group>;
}

function BattleWorldTelemetry({
  fighter,
  position,
  side,
  captureReady = false
}: {
  fighter: BattleFighter;
  position: [number, number, number];
  side: "player" | "wild";
  captureReady?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(fighter.hpRatio * 100)));
  return (
    <Html center distanceFactor={8} occlude={false} position={position} zIndexRange={[64, 56]}>
      <div
        aria-label={`${fighter.name} health ${fighter.hp} of ${fighter.maxHp}`}
        aria-valuemax={fighter.maxHp}
        aria-valuemin={0}
        aria-valuenow={fighter.hp}
        className={`wilds-battle-world-stat is-${side}${captureReady ? " capture-ready" : ""}`}
        role="meter"
      >
        <span><strong>{side === "wild" ? `Wild ${fighter.name}` : fighter.name}</strong><small>{fighter.hp}<b>HP</b></small></span>
        <i className="wilds-battle-world-stat-meter" aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>
      </div>
    </Html>
  );
}

function RemoteExplorer({
  player,
  localPlayer,
  onSelect
}: {
  player: WildsPresence;
  localPlayer: PlayState["player"];
  onSelect: (player: WildsPresence) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(player.x - localPlayer.x, 0, player.z - localPlayer.z));
  useEffect(() => {
    target.current.set(player.x - localPlayer.x, 0, player.z - localPlayer.z);
  }, [localPlayer.x, localPlayer.z, player.x, player.z]);
  useFrame(() => {
    group.current?.position.lerp(target.current, 0.18);
  });
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(player);
      }}
      position={[player.x - localPlayer.x, 0, player.z - localPlayer.z]}
      ref={group}
    >
      <WildsExplorer remote style={player.style} worldPosition={{ x: player.x, z: player.z }} />
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.04, 8, 32]} />
        <meshStandardMaterial color={player.practice ? "#f7c948" : "#6ef0c9"} emissive={player.practice ? "#f7c948" : "#37d688"} emissiveIntensity={0.62} />
      </mesh>
      <Html center className="wilds-remote-nameplate" distanceFactor={8} position={[0, 1.42, 0]} zIndexRange={[12, 0]}>
        <span>{player.handle}</span><small>{player.activeCard.name}</small>
      </Html>
    </group>
  );
}

function CameraRig({ onCameraHeadingChange }: { onCameraHeadingChange: (heading: number) => void }) {
  const lastHeading = useRef(Number.NaN);
  useFrame(({ camera }) => {
    const heading = Math.atan2(camera.position.x, camera.position.z);
    if (Number.isFinite(lastHeading.current) && Math.abs(heading - lastHeading.current) < .001) return;
    lastHeading.current = heading;
    onCameraHeadingChange(heading);
  });
  return (
    <OrbitControls
      dampingFactor={.08}
      enableDamping
      enablePan={false}
      maxDistance={13.5}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={4.8}
      minPolarAngle={.38}
      rotateSpeed={.62}
      target={[0, .55, 0]}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      zoomSpeed={.82}
    />
  );
}

function frameSeconds() {
  return performance.now() / 1_000;
}

function SearchableTerrain({
  player,
  enabled,
  missionProgress,
  qualityProfile,
  worldMastery,
  onSearchPoint,
  livingWorld,
  worldMode
}: {
  player: PlayState["player"];
  enabled: boolean;
  missionProgress: number;
  qualityProfile: WildsQualityProfile;
  worldMastery: number;
  onSearchPoint: (point: { x: number; z: number }) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
}) {
  return (
    <group
      onClick={(event) => {
        if (!enabled) return;
        event.stopPropagation();
        onSearchPoint({ x: player.x + event.point.x, z: player.z + event.point.z });
      }}
    >
      <StreamedTerrain missionProgress={missionProgress} player={player} qualityProfile={qualityProfile} worldMastery={worldMastery} livingWorld={livingWorld} worldMode={worldMode} />
    </group>
  );
}

function StreamedTerrain({
  missionProgress,
  player,
  qualityProfile,
  worldMastery,
  livingWorld,
  worldMode
}: {
  missionProgress: number;
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  worldMastery: number;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
}) {
  return <WildsEnvironment missionProgress={missionProgress} player={player} qualityProfile={qualityProfile} worldMastery={worldMastery} livingWorld={livingWorld} worldMode={worldMode} />;
}

function Creature({
  card,
  formId = `${card.id}-1`,
  pose = "idle",
  identity
}: {
  card: CreatureCard;
  formId?: string;
  pose?: WildsCreaturePose;
  identity?: Exclude<PlayState["encounter"], { phase: "idle" }>["discoveryIdentity"];
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const elapsed = frameSeconds();
    groupRef.current.position.y = 0.5 + Math.sin(elapsed * 1.8 + card.position[0]) * 0.06;
    groupRef.current.rotation.y = Math.sin(elapsed * 0.85 + card.position[2]) * 0.18;
  });

  return (
      <group ref={groupRef} position={[card.position[0], 0.42, card.position[2]]}>
        <WildsCreatureActor
          accent={identity?.palette.accent.css ?? card.accent}
          cadenceMs={identity?.motion.cadenceMs}
          familyId={card.id}
          formId={formId}
          identityToken={identity?.visualFingerprint}
          morphology={identity ? { head: identity.anatomy.head, torso: identity.anatomy.torso, limb: identity.anatomy.limb, symmetry: identity.anatomy.asymmetry } : undefined}
          pose={pose}
          primary={identity?.palette.primary.css ?? card.color}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
          <torusGeometry args={[0.46, 0.035, 8, 36]} />
          <meshStandardMaterial
            color="#fff2a8"
            emissive="#f7c948"
            emissiveIntensity={0.44}
            transparent
            opacity={0.95}
          />
        </mesh>
        <Html center distanceFactor={8} position={[0, 0.82, 0]} className="wilds-world-label" zIndexRange={[10, 0]}>
          <span>{identity?.name.display ?? card.name}</span>
        </Html>
      </group>
  );
}

function EncounterSequence({ state }: { state: PlayState }) {
  const encounter = state.encounter;
  if (encounter.phase === "idle") return null;
  const position: [number, number, number] = [
    encounter.searchPoint.x - state.player.x,
    0.04,
    encounter.searchPoint.z - state.player.z
  ];
  if (encounter.phase === "searching") {
    return <SearchPulse hint={false} position={position} />;
  }
  if (encounter.phase === "hint") {
    return (
      <>
        <SearchPulse hint position={position} />
        <RustlingClue encounter={encounter} player={state.player} />
      </>
    );
  }
  const card = creatureCards.find((candidate) => candidate.id === encounter.familyId);
  if (!card || !encounter.cover) return null;
  const localCard: CreatureCard = { ...card, position: [0, 0, 0] };
  const lastBattleAction = state.battle?.transcript.at(-1)?.action;
  const pose: WildsCreaturePose = encounter.phase === "capture_ready" ? "capture"
    : state.battle?.wild.hpRatio !== undefined && state.battle.wild.hpRatio <= 0.3 ? "weakened"
      : lastBattleAction === "ability" ? "impact"
        : lastBattleAction && lastBattleAction !== "capture" ? "attack"
        : encounter.phase === "battle_intro" ? "curious"
          : "idle";
  return (
    <group position={position}>
      <SearchPulse hint position={[0, 0, 0]} />
      <HabitatCover cover={encounter.cover} open={encounter.phase !== "emerging"} />
      <group scale={encounter.phase === "capsule" ? 0.68 : encounter.phase === "sealed" || encounter.phase === "revealed" ? 0.01 : 1}>
        <Creature card={localCard} formId={encounter.formId} identity={encounter.discoveryIdentity} pose={pose} />
      </group>
      {state.battle && isBattleTelemetryPhase(state.encounter.phase) ? (
        <BattleWorldTelemetry
          captureReady={encounter.phase === "capture_ready"}
          fighter={state.battle.wild}
          position={[0, 2.15, 0]}
          side="wild"
        />
      ) : null}
      {encounter.phase === "capsule" || encounter.phase === "sealed" || encounter.phase === "revealed" ? (
        <CaptureCapsule sealed={encounter.phase !== "capsule"} />
      ) : null}
    </group>
  );
}

function RustlingClue({
  encounter,
  player
}: {
  encounter: Exclude<PlayState["encounter"], { phase: "idle" }>;
  player: PlayState["player"];
}) {
  const ref = useRef<THREE.Group>(null);
  const hot = encounter.proximity === "hot";
  const clueSparkleCount = hot ? 18 : 9;
  const distance = encounter.distance ?? 0;
  const direction = encounter.direction ?? { x: 0, z: 0 };
  const position: [number, number, number] = [
    encounter.searchPoint.x + direction.x * distance - player.x,
    0.03,
    encounter.searchPoint.z + direction.z * distance - player.z
  ];

  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    const energy = hot ? 1 : 0.55;
    ref.current.rotation.y = Math.sin(elapsed * (hot ? 15 : 9)) * 0.12 * energy;
    ref.current.position.y = 0.03 + Math.abs(Math.sin(elapsed * 7)) * 0.045 * energy;
    const pulse = 1 + Math.sin(elapsed * 6) * 0.035 * energy;
    ref.current.scale.setScalar(pulse);
  });

  if (!encounter.cover) return null;
  return (
    <group ref={ref} position={position}>
      <HabitatCover cover={encounter.cover} open={false} />
      <Sparkles
        key={`wilds-clue-sparkles-${clueSparkleCount}`}
        count={clueSparkleCount}
        scale={hot ? [1.45, 1.05, 1.45] : [1.05, 0.7, 1.05]}
        size={hot ? 4 : 2.4}
        speed={hot ? 1.1 : 0.55}
        color={hot ? "#fff0a6" : "#d8fff2"}
      />
    </group>
  );
}

function SearchPulse({ hint, position }: { hint: boolean; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    const wave = 0.8 + (elapsed % 1) * 0.65;
    ref.current.scale.setScalar(wave);
    ref.current.rotation.y = elapsed * 0.7;
  });
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56, hint ? 0.045 : 0.028, 8, 48]} />
        <meshStandardMaterial color={hint ? "#fff2a8" : "#d8fff2"} emissive={hint ? "#f7c948" : "#37d688"} emissiveIntensity={0.75} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function HabitatCover({ cover, open }: { cover: HotspotCover; open: boolean }) {
  const colors: Record<string, string> = {
    grass: "#2f8d51", flowers: "#ff8dad", tree: "#236b43", rock: "#7f827d",
    cave: "#3b3446", water: "#45aee7", ruin: "#b49b75", energy: "#f7c948"
  };
  return (
    <group rotation={[0, open ? 0.62 : 0, open ? -0.24 : 0]}>
      {[-1, -0.5, 0, 0.5, 1].map((offset, index) => (
        <mesh key={offset} castShadow position={[offset * 0.25, 0.2 + Math.abs(offset) * 0.08, index % 2 ? -0.1 : 0.08]} rotation={[0.12, offset * 0.4, offset * -0.32]}>
          {cover === "rock" || cover === "cave" || cover === "ruin" ? <dodecahedronGeometry args={[0.24, 0]} /> : <coneGeometry args={[0.15, 0.52, cover === "water" ? 8 : 5]} />}
          <meshStandardMaterial color={colors[String(cover)] ?? colors.grass} roughness={0.78} metalness={cover === "energy" ? 0.24 : 0} emissive={cover === "energy" ? "#f7c948" : "#000000"} emissiveIntensity={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function CaptureCapsule({ sealed }: { sealed: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    ref.current.rotation.y = elapsed * (sealed ? 0.7 : 2.4);
    ref.current.position.y = 0.7 + Math.sin(elapsed * 3) * (sealed ? 0.04 : 0.1);
  });
  return (
    <group ref={ref} scale={sealed ? 0.9 : 1.08}>
      <mesh castShadow>
        <sphereGeometry args={[0.62, 28, 20]} />
        <meshPhysicalMaterial color="#f7fff9" roughness={0.18} metalness={0.18} transmission={sealed ? 0.05 : 0.42} transparent opacity={sealed ? 0.94 : 0.7} clearcoat={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.61, 0.075, 12, 48]} />
        <meshStandardMaterial color="#171311" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.62]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
        <meshStandardMaterial color={sealed ? "#37d688" : "#f7c948"} emissive={sealed ? "#37d688" : "#f7c948"} emissiveIntensity={0.72} />
      </mesh>
    </group>
  );
}

function CreatureDetails({ cardId, color, accent }: { cardId: string; color: string; accent: string }) {
  if (cardId === "mintcub") {
    return (
      <group>
        <mesh castShadow position={[-0.28, 0.36, -0.02]} rotation={[0, 0, -0.48]} scale={[0.55, 1, 0.38]}>
          <coneGeometry args={[0.18, 0.48, 5]} />
          <meshStandardMaterial color={accent} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0.28, 0.36, -0.02]} rotation={[0, 0, 0.48]} scale={[0.55, 1, 0.38]}>
          <coneGeometry args={[0.18, 0.48, 5]} />
          <meshStandardMaterial color={accent} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.43, -0.02]} rotation={[0.12, 0, 0.08]} scale={[0.45, 1, 0.22]}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#d9ff9f" roughness={0.6} emissive={color} emissiveIntensity={0.12} />
        </mesh>
      </group>
    );
  }

  if (cardId === "voltray") {
    return (
      <group>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.42, 0.08, -0.05]} rotation={[0.2, 0, side * -0.42]}>
            <mesh castShadow scale={[0.35, 0.85, 0.14]}>
              <tetrahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial color={accent} roughness={0.38} metalness={0.2} emissive={accent} emissiveIntensity={0.18} />
            </mesh>
            <mesh castShadow position={[side * 0.12, -0.18, 0]} scale={[0.25, 0.56, 0.12]}>
              <tetrahedronGeometry args={[0.34, 0]} />
              <meshStandardMaterial color="#fff1a8" roughness={0.4} />
            </mesh>
          </group>
        ))}
        <mesh castShadow position={[0, 0.5, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.09, 0.38, 5]} />
          <meshStandardMaterial color="#fff1a8" emissive={accent} emissiveIntensity={0.22} />
        </mesh>
      </group>
    );
  }

  if (cardId === "ledgerfox") {
    return (
      <group>
        {[-1, 1].map((side) => (
          <mesh key={side} castShadow position={[side * 0.24, 0.38, -0.03]} rotation={[0, 0, side * -0.18]} scale={[0.7, 1.35, 0.48]}>
            <coneGeometry args={[0.16, 0.42, 4]} />
            <meshStandardMaterial color={accent} roughness={0.58} />
          </mesh>
        ))}
        <group position={[0.35, -0.08, -0.24]} rotation={[0.2, 0.2, -0.68]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.09, 0.52, 6, 10]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#ecfff8" roughness={0.55} />
          </mesh>
        </group>
      </group>
    );
  }

  if (cardId === "titanseal") {
    return (
      <group>
        <mesh castShadow position={[-0.25, -0.02, 0.28]} rotation={[0.35, 0, 0.18]}>
          <coneGeometry args={[0.075, 0.38, 8]} />
          <meshStandardMaterial color="#fff2d4" roughness={0.42} />
        </mesh>
        <mesh castShadow position={[0.25, -0.02, 0.28]} rotation={[0.35, 0, -0.18]}>
          <coneGeometry args={[0.075, 0.38, 8]} />
          <meshStandardMaterial color="#fff2d4" roughness={0.42} />
        </mesh>
        {[-0.22, 0, 0.22].map((x, index) => (
          <mesh key={x} castShadow position={[x, 0.43 + Math.abs(x) * 0.25, -0.02]} rotation={[0, 0, x * 0.65]}>
            <coneGeometry args={[0.09, index === 1 ? 0.42 : 0.32, 5]} />
            <meshStandardMaterial color={accent} roughness={0.48} metalness={0.18} emissive={accent} emissiveIntensity={0.12} />
          </mesh>
        ))}
      </group>
    );
  }
  const form = creatureForm(`${cardId}-1`);
  if (!form) return null;
  const detail = form.anatomy.detail;
  return (
    <group>
      {(detail === "ears" || detail === "horns" || detail === "wings") ? [-1, 1].map((side) => (
        <mesh key={side} castShadow position={[side * 0.29, detail === "wings" ? 0.08 : 0.34, detail === "wings" ? -0.14 : -0.02]} rotation={[0, 0, side * (detail === "wings" ? -0.7 : -0.24)]} scale={detail === "wings" ? [0.45, 1.3, 0.18] : [0.65, 1.1, 0.5]}>
          <coneGeometry args={[detail === "wings" ? 0.24 : 0.14, detail === "wings" ? 0.7 : 0.4, detail === "horns" ? 7 : 4]} />
          <meshStandardMaterial color={accent} emissive={detail === "wings" ? accent : "#000000"} emissiveIntensity={0.12} roughness={0.55} />
        </mesh>
      )) : null}
      {detail === "crest" ? <mesh castShadow position={[0, 0.46, -0.03]}><octahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color={accent} emissive={color} emissiveIntensity={0.14} /></mesh> : null}
      {detail === "shell" ? <mesh castShadow position={[0, 0, -0.24]} scale={[1.1, 0.85, 0.4]}><sphereGeometry args={[0.38, 14, 10]} /><meshStandardMaterial color={accent} roughness={0.75} /></mesh> : null}
      {detail === "tail" ? <mesh castShadow position={[0.37, -0.08, -0.25]} rotation={[0.1, 0.1, -0.7]}><capsuleGeometry args={[0.075, 0.48, 5, 8]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh> : null}
    </group>
  );
}

function WildsDiagnostics({
  qualityProfile,
  state
}: {
  qualityProfile: WildsQualityProfile;
  state: PlayState;
}) {
  const { camera, gl, scene, size } = useThree();
  const outputRef = useRef<HTMLOutputElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const sample = () => {
    const currentState = stateRef.current;
    const extra = {
      camera: { position: camera.position.toArray(), fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : null },
      scene: { children: scene.children.length },
      boss: scene.getObjectByName("wilds-boss-environment")?.userData ?? { detailedBosses: 0, maxDetailedBosses: 1 }
    };
    publishWildsDiagnostics(gl, size, currentState, qualityProfile, extra);
    if (outputRef.current) {
      outputRef.current.dataset.snapshot = JSON.stringify({
        canvas: { width: size.width, height: size.height, dpr: gl.getPixelRatio() },
        render: gl.info.render,
        memory: gl.info.memory,
        state: { player: currentState.player, missionProgress: currentState.missionProgress, energy: currentState.energy, combo: currentState.combo },
        ...extra
      });
    }
    };
    sample();
    const interval = window.setInterval(sample, 500);
    return () => window.clearInterval(interval);
  }, [camera, gl, qualityProfile, scene, size]);

  return (
    <Html className="wilds-diagnostics-anchor">
      <output
        data-snapshot="pending"
        data-three-game-diagnostics
        ref={outputRef}
      />
    </Html>
  );
}

function publishWildsDiagnostics(
  gl: THREE.WebGLRenderer,
  size: { width: number; height: number },
  state: PlayState,
  qualityProfile: WildsQualityProfile,
  extra: Record<string, unknown> = {}
) {
  const budget = rendererBudgetStatus(qualityProfile, {
    calls: gl.info.render.calls,
    triangles: gl.info.render.triangles
  });
  const diagnostics = {
    renderer: gl.info,
    canvas: {
      cssWidth: size.width,
      cssHeight: size.height,
      drawingBufferWidth: gl.domElement.width,
      drawingBufferHeight: gl.domElement.height,
      dpr: gl.getPixelRatio()
    },
    state: {
      player: state.player,
      selectedCardId: state.selectedCardId,
      discovered: state.discoveredCardIds.length,
      missionProgress: state.missionProgress,
      energy: state.energy,
      combo: state.combo
    },
    quality: { tier: qualityProfile.tier, dpr: qualityProfile.dpr },
    budget,
    warningFreeCompatibility: { three: "0.182.0", shadowType: "PCFShadowMap" },
    ...extra
  };
  (window as typeof window & { __THREE_GAME_DIAGNOSTICS__?: unknown }).__THREE_GAME_DIAGNOSTICS__ = diagnostics;
  gl.domElement.dataset.threeGameDiagnostics = JSON.stringify({
    canvas: diagnostics.canvas,
    state: diagnostics.state,
    render: {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines
    },
    memory: gl.info.memory,
    quality: diagnostics.quality,
    budget: diagnostics.budget,
    warningFreeCompatibility: diagnostics.warningFreeCompatibility,
    ...extra
  });
}
