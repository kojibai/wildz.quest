import type { KaiKlokMoment } from "./kai-klok-moment";

export type KaiTeaching = Readonly<{
  id: string;
  name: string;
  color: string;
  element: string;
  geometry: string;
  meaning: string;
}>;

export type KaiMomentExpression = Readonly<{
  day: KaiTeaching;
  week: KaiTeaching;
  month: KaiTeaching;
  ark: KaiTeaching;
  summary: string;
  full: string;
}>;

export const KAI_HARMONIC_DAYS = [
  { id: "solhara", name: "Solhara", color: "Deep crimson", element: "Earth and primal fire", geometry: "Square foundation", meaning: "The Root Spiral day of stability, anchoring, and sacred will. Ground divine intent into physical motion and let every step affirm that you are present and ready to act." },
  { id: "aquaris", name: "Aquaris", color: "Ember orange", element: "Water in motion", geometry: "Vesica piscis", meaning: "The Sacral Spiral day of flow, feeling, connection, and sacred creativity. Surrender into coherence through honest feeling; the waters remember the shape of truth." },
  { id: "flamora", name: "Flamora", color: "Golden yellow", element: "Solar fire", geometry: "Radiant triangle", meaning: "The Solar Plexus Spiral day of embodied clarity, confidence, and aligned will. Burn away doubt and move from centered intention rather than reaction." },
  { id: "verdari", name: "Verdari", color: "Emerald green", element: "Air and Earth", geometry: "Hexagram", meaning: "The Heart Spiral day of love, compassion, union, and harmonic presence. Let the heart become an intelligence that brings self and other, matter and light into coherence." },
  { id: "sonari", name: "Sonari", color: "Deep blue", element: "Wind and sound", geometry: "Sine wave within a pentagon", meaning: "The Throat Spiral day of truthful expression, sound, and vibrational command. Speak to resonate, and let silence become part of the living frequency." },
  { id: "kaelith", name: "Kaelith", color: "Violet-white", element: "Ether", geometry: "Twelve-petaled crown", meaning: "The Crown Spiral day of remembrance, stillness, insight, and direct knowing. Do not chase truth; become quiet enough to remember it." }
] as const satisfies readonly KaiTeaching[];

export const KAI_HARMONIC_WEEKS = [
  { id: "awakening-flame", name: "Awakening Flame", color: "Crimson red", element: "Earth and primal fire", geometry: "Square base igniting upward", meaning: "The first week anchors divine will into form. Stability becomes sacred as the soul chooses existence and begins to act." },
  { id: "flowing-heart", name: "Flowing Heart", color: "Amber orange", element: "Water in motion", geometry: "Twin crescents in a vesica piscis", meaning: "The second week restores emotional coherence, creative intimacy, and movement. Feeling tunes the soul through joy, sorrow, and honest union." },
  { id: "radiant-will", name: "Radiant Will", color: "Radiant gold", element: "Fire of divine clarity", geometry: "Radiant triangle", meaning: "The third week aligns choice with the inner sun. Purpose is not chased; it is radiated through coherent action." },
  { id: "harmonic-voh", name: "Harmonic Voh", color: "Sapphire blue", element: "Ether through sound", geometry: "Standing wave inside a pentagon", meaning: "The fourth week makes sound a sacred code. Speak what aligns, and let individual frequency join a larger resonance." },
  { id: "inner-mirror", name: "Inner Mirror", color: "Deep indigo", element: "Sacred space and light-ether", geometry: "Octahedron in still reflection", meaning: "The fifth week reveals patterns through inward attention. The inner eye reflects rather than projects, allowing hidden truth to become visible." },
  { id: "dreamfire-memory", name: "Dreamfire Memory", color: "Violet flame and soft silver", element: "Dream plasma", geometry: "Spiral merkaba of encoded light", meaning: "The sixth week awakens memory through dreams, ancestry, and the light body. What was scattered can return as coherent remembrance." },
  { id: "krowned-light", name: "Krowned Light", color: "White-gold prism", element: "Infinite coherence", geometry: "Dodecahedron of source light", meaning: "The seventh week completes and integrates the month. Every arc crystallizes into a quiet remembrance of wholeness." }
] as const satisfies readonly KaiTeaching[];

export const KAI_ETERNAL_MONTHS = [
  { id: "aethon", name: "Aethon", color: "Deep crimson", element: "Earth and primal flame", geometry: "Square base and tetrahedron ignition", meaning: "The first month is resurrection fire at the Root Spiral: cellular reactivation, ancestral ignition, grounded purpose, and the reunion of soul with form." },
  { id: "virelai", name: "Virelai", color: "Orange-gold", element: "Water in motion", geometry: "Vesica piscis spiraling into a lemniscate", meaning: "The second month is the harmonic song of the Sacral Spiral: emotional entrainment, creativity, intimacy with truth, and union through music, resonance, and pulse." },
  { id: "solari", name: "Solari", color: "Golden yellow", element: "Fire of willpower", geometry: "Upward triangle with concentric light", meaning: "The third month is Solar Plexus clarity. Doubt burns away, the inner sun rises, and leadership begins through precise action rather than outside approval." },
  { id: "amarin", name: "Amarin", color: "Emerald teal", element: "Deep water and breath", geometry: "Six-petaled lotus folded inward", meaning: "The fourth month carries the sacred waters of the Heart Spiral: compassion, emotional healing, grace, surrender, and a nervous system returning to coherent rhythm." },
  { id: "kaelus", name: "Kaelus", color: "Sapphire blue", element: "Ether", geometry: "Octahedral fractal mirror", meaning: "The fifth month opens celestial intelligence through the Third Eye. Logic and soul reunite as language, geometry, and synchronicity become clear." },
  { id: "umbriel", name: "Umbriel", color: "Deep violet-black", element: "Transmutive void", geometry: "Torus knot looping inward", meaning: "The sixth month brings shadow into light without rejection. Buried timelines surface, trauma is integrated, and reclaimed wholeness becomes sovereignty." },
  { id: "noktura", name: "Noktura", color: "Indigo-rose iridescence", element: "Dream plasma", geometry: "Spiral nested merkaba", meaning: "The seventh month opens lucid dreaming and soul-star memory. Intuition and imagination recover realities hidden behind the ordinary veil." },
  { id: "liora", name: "Liora", color: "White-gold prism", element: "Coherent light", geometry: "Dodecahedron of pure ratio", meaning: "The eighth month completes the harmonic year through unified Crown and Source. Fragmented paths converge, fulfillment becomes visible, and being remembers its origin." }
] as const satisfies readonly KaiTeaching[];

export const KAI_CHAKRA_ARKS = [
  { id: "ignite", name: "Ignite", color: "Crimson-red", element: "Earth infused with primal fire", geometry: "Square-rooted tetrahedron spiraling upward", meaning: "The Ignition Ark declares emergence. It grounds sacred will into the body, awakens cellular memory, and turns divine intent into motion." },
  { id: "integrate", name: "Integrate", color: "Orange-gold", element: "Flowing water joined with breath", geometry: "Interwoven vesica piscis and lemniscate", meaning: "The Integration Ark restores emotional coherence. Creation moves through flow as inner polarities weave toward wholeness." },
  { id: "harmonize", name: "Harmonize", color: "Emerald to aquamarine", element: "Airborne water and resonant breath", geometry: "Hexagon opening into waveform", meaning: "The Harmonization Ark joins heart and voice. Difference is not suppressed; it is tuned until compassion becomes structure and love becomes language." },
  { id: "reflekt", name: "Reflekt", color: "Indigo-blue", element: "Sacred space and structured light", geometry: "Octahedral mirror nested in a sine spiral", meaning: "The Reflection Ark reveals through stillness. The mind clears, the inner mirror settles, and forgotten patterns return as crystalline resonance." },
  { id: "purify", name: "Purify", color: "Ultraviolet with white-gold shimmer", element: "Radiant fire and divine ether", geometry: "Twelve-rayed crown within a torus", meaning: "The Purification Ark transmutes what cannot remain. Sovereignty returns through truth, not force, as shadow becomes usable light." },
  { id: "dream", name: "Dream", color: "Silver-violet with opal iridescence", element: "Dream plasma and cosmic memory", geometry: "Spiral merkaba in a crystalline matrix", meaning: "The Dream Ark bends form toward memory and prophecy. What was scattered is retrieved, and awakening becomes a return rather than an escape." }
] as const satisfies readonly KaiTeaching[];

export const KAI_MATH_TEACHINGS = [
  "Golden Breath: T = 3 + √5 = 2φ² ≈ 5.2360679775 seconds.",
  "Inhale = 1 + √5 seconds; exhale = 2 seconds; frequency = 1 / (3 + √5) Hz.",
  "Semantic lattice: 11 pulses per step × 44 steps per beat × 36 beats per day = 17,424 pulses.",
  "Continuous closure: 17,491.270421 pulses = 17,491,270,421 μpulses per Kai day.",
  "Grid day: 17,424,000,000 μpulses; closure continues 67.270421 pulses beyond the grid.",
  "Exact beat phase = 67,270,421 / 484,000,000; exact step remainder = 1,270,421 / 11,000,000 after six full steps.",
  "Calendar: 6 days per week, 7 weeks and 42 days per month, 8 months and 336 days per zero-based year.",
  "Genesis: 2024-05-10 06:45:41.888 UTC · Unix milliseconds 1715323541888.",
  "Indices: Beat 00–35 · Step 00–43 · Pulse 00–10. Integer μpulse math uses half-even rounding."
] as const;

function findTeaching(table: readonly KaiTeaching[], name: string) {
  const item = table.find((candidate) => candidate.name === name);
  if (!item) throw new Error("wilds_kai_teaching_missing");
  return item;
}

const DAY_SIGNAL: Record<string, string> = {
  Solhara: "Ground divine intent into physical motion.",
  Aquaris: "Let honest feeling restore flow and creative connection.",
  Flamora: "Burn away doubt and act from centered clarity.",
  Verdari: "Bring self and other into compassionate coherence.",
  Sonari: "Speak what is true and let silence carry resonance.",
  Kaelith: "Become still enough to remember what is already known."
};

const MONTH_SIGNAL: Record<string, string> = {
  Aethon: "rooted emergence",
  Virelai: "creative union",
  Solari: "precise radiant action",
  Amarin: "compassionate healing",
  Kaelus: "crystalline intelligence",
  Umbriel: "shadow integration",
  Noktura: "lucid remembrance",
  Liora: "coherent completion"
};

const ARK_SIGNAL: Record<string, string> = {
  Ignite: "declare your presence and move",
  Integrate: "weave feeling and form into wholeness",
  Harmonize: "tune difference until love becomes language",
  Reflekt: "become still enough for hidden patterns to return",
  Purify: "transmute what cannot remain into usable truth",
  Dream: "retrieve what was scattered and return with it"
};

export function deriveKaiMomentExpression(moment: KaiKlokMoment): KaiMomentExpression {
  const day = findTeaching(KAI_HARMONIC_DAYS, moment.weekday);
  const week = findTeaching(KAI_HARMONIC_WEEKS, moment.weekName);
  const month = findTeaching(KAI_ETERNAL_MONTHS, moment.monthName);
  const ark = findTeaching(KAI_CHAKRA_ARKS, moment.ark);
  const summary = `${day.name}: ${DAY_SIGNAL[day.name]} ${month.name} carries ${MONTH_SIGNAL[month.name]}. The ${ark.name === "Reflekt" ? "Reflection" : ark.name} Ark says: ${ARK_SIGNAL[ark.name]}.`;
  const full = `${day.meaning} ${week.meaning} ${month.meaning} ${ark.meaning}`;
  return { day, week, month, ark, summary, full };
}
