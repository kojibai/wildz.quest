import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { KaiKlokMoment } from "../kai-klok-moment";

export type WildsCommandAction =
  | { type: "open-mission" }
  | { type: "open-field-guide" }
  | { type: "open-satchel" }
  | { type: "open-trail-pack" }
  | { type: "open-vault" }
  | { type: "open-map" }
  | { type: "activate-context" };

export type WildsCommandUrgency = "calm" | "opportunity" | "warning" | "critical";
export type WildsCommandCategory = "squad" | "battle" | "world" | "mission" | "multiplayer" | "system";

export type WildsCommandPriority = {
  id: string;
  category: WildsCommandCategory;
  urgency: WildsCommandUrgency;
  title: string;
  consequence: string;
  score: number;
  action: WildsCommandAction | null;
};

export type WildsCommandCenterInput = {
  moment: KaiKlokMoment;
  connected: boolean;
  worldRevision: number;
  energy: number;
  creature: {
    assetId: string;
    name: string;
    life: "alive" | "critical" | "dead" | "retired";
    health: number;
    maxHealth: number;
    fatigue: number;
  } | null;
  battle: { id: string; opponent: string; health: number; maxHealth: number } | null;
  mission: { title: string; progress: number; reward: string };
  nearby: {
    landmark: { id: string; name: string } | null;
    ecology: { id: string; name: string } | null;
    boss: { id: string; name: string } | null;
    livePlayer: { id: string; name: string } | null;
  };
  pendingReward: boolean;
  pendingOperation: string | null;
  acknowledgedCausalIds: readonly string[];
};

export type WildsCommandCenterModel = {
  connection: "online" | "offline";
  causalId: string;
  isNew: boolean;
  moment: KaiKlokMoment;
  palette: { primary: string; hue: number; sides: number; gate: string };
  now: WildsCommandPriority;
  priorities: WildsCommandPriority[];
};

const categoryOrder: Record<WildsCommandCategory, number> = {
  squad: 0,
  battle: 1,
  world: 2,
  mission: 3,
  multiplayer: 4,
  system: 5
};

function priority(input: Omit<WildsCommandPriority, "id"> & { id: string }) {
  return input;
}

function creaturePriorities(input: WildsCommandCenterInput): WildsCommandPriority[] {
  const creature = input.creature;
  if (!creature) return [priority({
    id: "squad:no-leader",
    category: "squad",
    urgency: "warning",
    title: "Choose a living leader",
    consequence: "The squad has no playable lead creature.",
    score: 820,
    action: { type: "open-vault" }
  })];
  if (creature.life === "dead" || creature.life === "retired") return [priority({
    id: `squad:unplayable:${creature.assetId}`,
    category: "squad",
    urgency: "critical",
    title: `${creature.name} cannot deploy`,
    consequence: "Select a living owned creature before entering consequential play.",
    score: 1_100,
    action: { type: "open-vault" }
  })];
  const healthRatio = creature.maxHealth > 0 ? creature.health / creature.maxHealth : 0;
  if (creature.life === "critical" || healthRatio <= 0.1 || creature.fatigue >= 90) return [priority({
    id: `squad:critical:${creature.assetId}`,
    category: "squad",
    urgency: "critical",
    title: `${creature.name} is near the limit`,
    consequence: "Continuing risks an irreversible creature consequence. Switch, heal, or rest now.",
    score: 1_050,
    action: { type: "open-trail-pack" }
  })];
  if (healthRatio <= 0.35 || creature.fatigue >= 70) return [priority({
    id: `squad:warning:${creature.assetId}`,
    category: "squad",
    urgency: "warning",
    title: `${creature.name} needs recovery`,
    consequence: "The next difficult encounter will carry elevated risk.",
    score: 780,
    action: { type: "open-satchel" }
  })];
  return [priority({
    id: `squad:ready:${creature.assetId}`,
    category: "squad",
    urgency: "calm",
    title: `${creature.name} is ready`,
    consequence: `${creature.health}/${creature.maxHealth} health · ${creature.fatigue}% fatigue.`,
    score: 120,
    action: { type: "open-trail-pack" }
  })];
}

function candidatePriorities(input: WildsCommandCenterInput) {
  const values: WildsCommandPriority[] = [...creaturePriorities(input)];
  if (input.battle) values.push(priority({
    id: `battle:${input.battle.id}`,
    category: "battle",
    urgency: input.battle.health / Math.max(1, input.battle.maxHealth) <= 0.2 ? "critical" : "warning",
    title: `${input.battle.opponent} is engaged`,
    consequence: `${input.battle.health}/${input.battle.maxHealth} squad health remains in this fight.`,
    score: 920,
    action: { type: "activate-context" }
  }));
  if (input.energy < 25) values.push(priority({
    id: "system:energy-low",
    category: "system",
    urgency: "warning",
    title: "Explorer energy is low",
    consequence: "Rest before committing to a long route or difficult encounter.",
    score: 760,
    action: { type: "open-satchel" }
  }));
  if (input.pendingReward) values.push(priority({
    id: "world:pending-reward",
    category: "world",
    urgency: "opportunity",
    title: "A verified reward is waiting",
    consequence: "Receive it before moving beyond this discovery moment.",
    score: 710,
    action: { type: "activate-context" }
  }));
  if (input.nearby.boss) values.push(priority({
    id: `world:boss:${input.nearby.boss.id}`,
    category: "world",
    urgency: "opportunity",
    title: `${input.nearby.boss.name} is active nearby`,
    consequence: input.connected ? "A shared raid can change the canonical world." : "Reconnect to enter this shared raid.",
    score: 670,
    action: input.connected ? { type: "activate-context" } : null
  }));
  if (input.nearby.ecology) values.push(priority({
    id: `world:ecology:${input.nearby.ecology.id}`,
    category: "world",
    urgency: "opportunity",
    title: `${input.nearby.ecology.name} is changing`,
    consequence: "Entering now can append this ecology to the world history.",
    score: 620,
    action: { type: "activate-context" }
  }));
  if (input.nearby.livePlayer) values.push(priority({
    id: `multiplayer:${input.nearby.livePlayer.id}`,
    category: "multiplayer",
    urgency: "opportunity",
    title: `${input.nearby.livePlayer.name} is within signal range`,
    consequence: input.connected ? "Challenge, greet, or coordinate while the signal is live." : "Reconnect to interact with this explorer.",
    score: 540,
    action: input.connected ? { type: "activate-context" } : null
  }));
  if (input.nearby.landmark) values.push(priority({
    id: `world:landmark:${input.nearby.landmark.id}`,
    category: "world",
    urgency: "opportunity",
    title: `${input.nearby.landmark.name} is in reach`,
    consequence: "Enter to continue its location-specific gameplay and history.",
    score: 500,
    action: { type: "activate-context" }
  }));
  if (input.pendingOperation) values.push(priority({
    id: `system:pending:${input.pendingOperation}`,
    category: "system",
    urgency: "calm",
    title: "A consequence is being admitted",
    consequence: "The neural paths will settle when authoritative state returns.",
    score: 480,
    action: null
  }));
  values.push(priority({
    id: `mission:${input.mission.title}:${input.mission.progress}`,
    category: "mission",
    urgency: input.mission.progress >= 80 ? "opportunity" : "calm",
    title: input.mission.title,
    consequence: `${input.mission.progress}% complete · ${input.mission.reward}`,
    score: input.mission.progress >= 80 ? 580 : 300,
    action: { type: "open-mission" }
  }));
  values.push(priority({
    id: "world:atlas",
    category: "world",
    urgency: "calm",
    title: "Explore the living world",
    consequence: "Open the atlas without leaving the command flow.",
    score: 180,
    action: { type: "open-map" }
  }));
  return values;
}

export function projectWildsCommandCenter(input: WildsCommandCenterInput): WildsCommandCenterModel {
  const priorities = candidatePriorities(input).sort((left, right) =>
    right.score - left.score
    || categoryOrder[left.category] - categoryOrder[right.category]
    || left.id.localeCompare(right.id)
  );
  const now = priorities[0]!;
  const causalId = `command:${sha256PortableBasis(canonicalPortableCardJson({
    pulse: input.moment.pulse,
    worldRevision: input.worldRevision,
    now: now.id,
    priorities: priorities.map(({ id, urgency, action }) => ({ id, urgency, action }))
  })).slice(7, 39)}`;
  return {
    connection: input.connected ? "online" : "offline",
    causalId,
    isNew: !input.acknowledgedCausalIds.includes(causalId),
    moment: input.moment,
    palette: {
      primary: input.moment.accent,
      hue: input.moment.hue,
      sides: input.moment.sides,
      gate: input.moment.gate
    },
    now,
    priorities
  };
}
