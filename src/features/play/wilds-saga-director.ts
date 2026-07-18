import type { KaiArkName, KaiKlokMoment } from "./kai-klok-moment";
import type { WildsDailyChapterDefinition, WildsSagaFramework, WildsStoryOutcome } from "./wilds-saga-types";

export type WildsChapterMemory = Readonly<{
  chapterId: string;
  dayId: string;
  outcome: WildsStoryOutcome;
  hookId: string;
  settledEventId: string;
  settledAt: string;
}>;

export type WildsSagaInstanceIds = Readonly<{
  yearId: string;
  monthId: string;
  weekId: string;
  dayId: string;
}>;

export type WildsSagaProjection = Readonly<{
  frameworkVersion: "kai-saga.v1";
  yearId: string;
  monthId: string;
  weekId: string;
  dayId: string;
  momentCoordinate: string;
  chapter: WildsDailyChapterDefinition;
  act: { ark: KaiArkName; index: number; progress: number; directive: string };
  activeConsequences: readonly WildsChapterMemory[];
  nextTransition: "beat" | "ark" | "day";
}>;

const DAY_INDEX: Readonly<Record<KaiKlokMoment["weekday"], 0 | 1 | 2 | 3 | 4 | 5>> = {
  Solhara: 0,
  Aquaris: 1,
  Flamora: 2,
  Verdari: 3,
  Sonari: 4,
  Kaelith: 5
};

function part(value: string) {
  return value.toLowerCase().replaceAll(" ", "-");
}

export function wildsSagaInstanceIds(moment: KaiKlokMoment): WildsSagaInstanceIds {
  const yearId = `saga:year:Y${moment.year}`;
  const monthId = `saga:month:Y${moment.year}:M${moment.month}:${part(moment.monthName)}`;
  const weekId = `saga:week:Y${moment.year}:M${moment.month}:W${moment.week}:${part(moment.weekName)}`;
  const dayId = `saga:day:Y${moment.year}:M${moment.month}:D${moment.day}`;
  return { yearId, monthId, weekId, dayId };
}

function validMemories(memories: readonly WildsChapterMemory[]) {
  return memories
    .filter((memory) => memory.chapterId && memory.dayId && memory.hookId && memory.settledEventId && Number.isFinite(Date.parse(memory.settledAt)))
    .sort((left, right) => left.settledAt.localeCompare(right.settledAt) || left.settledEventId.localeCompare(right.settledEventId))
    .slice(-32);
}

export function projectWildsSaga(input: {
  moment: KaiKlokMoment;
  framework: WildsSagaFramework;
  memories: readonly WildsChapterMemory[];
}): WildsSagaProjection {
  if (input.framework.version !== "kai-saga.v1") throw new Error("wilds_saga_framework_unsupported");
  const chapter = input.framework.dailyChapters.find((candidate) => candidate.dayIndex === DAY_INDEX[input.moment.weekday]);
  if (!chapter || chapter.chakra !== input.moment.chakra || chapter.gate !== input.moment.gate) {
    throw new Error("wilds_saga_geometry_mismatch");
  }
  const ids = wildsSagaInstanceIds(input.moment);
  const nextTransition = input.moment.ark === "Dream"
    ? "day"
    : input.moment.stepIndex === 43 && input.moment.pulseInStep === 10
      ? "ark"
      : "beat";
  return {
    frameworkVersion: input.framework.version,
    ...ids,
    momentCoordinate: input.moment.coordinate,
    chapter,
    act: {
      ark: input.moment.ark,
      index: input.moment.arkIndex,
      progress: input.moment.arkProgress,
      directive: chapter.acts[input.moment.ark]
    },
    activeConsequences: validMemories(input.memories),
    nextTransition
  };
}
