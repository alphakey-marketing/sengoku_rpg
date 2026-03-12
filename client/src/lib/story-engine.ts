/**
 * story-engine.ts  (Phase 3 — localStorage only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure localStorage state manager. Zero network calls.
 * Every function is async so the Phase 5 API swap is a one-file change.
 *
 * Storage keys (prefix: "sengoku_story_")
 *   sengoku_story_progress  → ProgressState
 *   sengoku_story_flags     → StoryFlags
 *   sengoku_story_seen      → number[]
 *   sengoku_story_endings   → UnlockedEnding[]
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressState {
  chapterId: number;
  currentSceneId: number | null;
  isCompleted: boolean;
  startedAt: string;
  completedAt: string | null;
}

export interface StoryFlags {
  [flagKey: string]: number;
}

export interface UnlockedEnding {
  endingKey: string;
  endingTitle: string;
  endingDescription: string;
  unlockedAt: string;
}

export interface StoryEngineSnapshot {
  progress: ProgressState | null;
  flags: StoryFlags;
  seenSceneIds: number[];
  endings: UnlockedEnding[];
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  progress: "sengoku_story_progress",
  flags:    "sengoku_story_flags",
  seen:     "sengoku_story_seen",
  endings:  "sengoku_story_endings",
} as const;

// ─── Low-level helpers ────────────────────────────────────────────────────────

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Static chapter data ──────────────────────────────────────────────────────
// Phase 5 replaces fetchChapter() with a real fetch('/api/story/chapters/id').
// The shape here matches what the API will return so story.tsx never changes.

export interface DialogueLine {
  id: number;
  speakerName: string;
  speakerSide: "left" | "right" | "none";
  portraitKey: string | null;
  text: string;
  lineOrder: number;
}

export interface Choice {
  id: number;
  choiceText: string;
  nextSceneId: number;
  flagKey: string | null;
  flagValue: number | null;
  flagKey2: string | null;
  flagValue2: number | null;
  choiceOrder: number;
}

export interface Scene {
  id: number;
  sceneOrder: number;
  backgroundKey: string;
  bgmKey: string;
  nextSceneId: number | null;
  isBattleGate: boolean;
  battleEnemyKey?: string | null;
  battleWinSceneId?: number | null;
  battleLoseSceneId?: number | null;
  isChapterEnd: boolean;
  dialogueLines: DialogueLine[];
  choices: Choice[];
}

export interface ChapterData {
  id: number;
  title: string;
  subtitle: string | null;
  firstSceneId: number | null;
  isLocked: boolean;
  scenes: Scene[];
}

const CHAPTER_1: ChapterData = {
  id: 1,
  title: "The Fool of Owari",
  subtitle: "1551 — The land mocks you. Let it.",
  firstSceneId: 1,
  isLocked: false,
  scenes: [
    {
      id: 1, sceneOrder: 1, backgroundKey: "owari_province_dawn", bgmKey: "bgm_owari_morning",
      nextSceneId: 2, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 1,  speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,            text: "Your father died this morning. The clan elders already whisper — the fool inherits nothing worth keeping.", lineOrder: 1 },
        { id: 2,  speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_cold", text: "Let them whisper.", lineOrder: 2 },
      ],
      choices: [],
    },
    {
      id: 2, sceneOrder: 2, backgroundKey: "owari_castle_interior", bgmKey: "bgm_tense_court",
      nextSceneId: null, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 3,  speakerName: "Elder Hayashi", speakerSide: "left",  portraitKey: "hayashi_stern", text: "You eat with commoners. You dress like a vagrant. You are an embarrassment to the Oda name.", lineOrder: 1 },
        { id: 4,  speakerName: "Nobunaga",      speakerSide: "right", portraitKey: "nobunaga_cold", text: "And yet here I am. And there you sit, asking my permission.", lineOrder: 2 },
        { id: 5,  speakerName: "Elder Hayashi", speakerSide: "left",  portraitKey: "hayashi_stern", text: "The council demands you submit to our oversight. You are young, untested, and reckless.", lineOrder: 3 },
        { id: 6,  speakerName: "Narrator",      speakerSide: "none",  portraitKey: null,            text: "The elders watch you. Your first answer as lord of Owari will define what kind of warlord you become.", lineOrder: 4 },
      ],
      choices: [
        { id: 1, choiceText: "\"I submit. For now. A wise lord listens before he acts.\"", nextSceneId: 3, flagKey: "political_power", flagValue: 1, flagKey2: null, flagValue2: null, choiceOrder: 1 },
        { id: 2, choiceText: "\"Kneel to no council. I am Oda Nobunaga.\"",               nextSceneId: 4, flagKey: "ruthlessness",    flagValue: 1, flagKey2: null, flagValue2: null, choiceOrder: 2 },
      ],
    },
    {
      id: 3, sceneOrder: 3, backgroundKey: "owari_castle_interior", bgmKey: "bgm_tense_court",
      nextSceneId: 5, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 7, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,              text: "They smile. They think you are tamed. They are wrong.", lineOrder: 1 },
        { id: 8, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_smirk", text: "A fox does not announce the hunt.", lineOrder: 2 },
      ],
      choices: [],
    },
    {
      id: 4, sceneOrder: 4, backgroundKey: "owari_castle_exterior", bgmKey: "bgm_defiance",
      nextSceneId: 5, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 9,  speakerName: "Elder Hayashi", speakerSide: "left",  portraitKey: "hayashi_shocked", text: "You'll be dead within a year.", lineOrder: 1 },
        { id: 10, speakerName: "Nobunaga",      speakerSide: "right", portraitKey: "nobunaga_fierce", text: "Then enjoy this year. It's the last you'll have power over anything.", lineOrder: 2 },
      ],
      choices: [],
    },
    {
      id: 5, sceneOrder: 5, backgroundKey: "owari_road_afternoon", bgmKey: "bgm_journey",
      nextSceneId: null, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 11, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,                text: "A samurai from Mino arrives at your gate. Educated. Sharp-eyed. Looking for a lord worth serving.", lineOrder: 1 },
        { id: 12, speakerName: "Mitsuhide", speakerSide: "left",  portraitKey: "mitsuhide_calm",    text: "I have heard of the Fool of Owari. I came to see if the rumors were true.", lineOrder: 2 },
        { id: 13, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_cold",     text: "And?", lineOrder: 3 },
        { id: 14, speakerName: "Mitsuhide", speakerSide: "left",  portraitKey: "mitsuhide_resolve", text: "They undersell you. I would serve you, if you'll have me.", lineOrder: 4 },
        { id: 15, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,                text: "How you receive him sets the tone of your most important relationship.", lineOrder: 5 },
      ],
      choices: [
        { id: 3, choiceText: "\"Welcome. A brilliant mind is rare — I'd be a fool to turn one away.\"", nextSceneId: 6, flagKey: "mitsuhide_loyalty", flagValue: 2,  flagKey2: null,               flagValue2: null, choiceOrder: 1 },
        { id: 4, choiceText: "\"Prove yourself first. Fetch water from the well.\"",                    nextSceneId: 6, flagKey: "mitsuhide_loyalty", flagValue: 0,  flagKey2: null,               flagValue2: null, choiceOrder: 2 },
        { id: 5, choiceText: "\"I trust no outsiders. Be gone.\"",                                      nextSceneId: 6, flagKey: "mitsuhide_loyalty", flagValue: -1, flagKey2: "ruthlessness", flagValue2: 1,    choiceOrder: 3 },
      ],
    },
    {
      id: 6, sceneOrder: 6, backgroundKey: "nagashino_ruins_dusk", bgmKey: "bgm_ominous",
      nextSceneId: null, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 16, speakerName: "Monk Messenger", speakerSide: "left",  portraitKey: "monk_fearful", text: "My lord — near Nagashino. Workers unearthed a blade. Three men dead. No wounds. The blade sings at night.", lineOrder: 1 },
        { id: 17, speakerName: "Nobunaga",        speakerSide: "right", portraitKey: "nobunaga_cold", text: "...", lineOrder: 2 },
        { id: 18, speakerName: "Narrator",        speakerSide: "none",  portraitKey: null,            text: "A cursed blade. Power wrapped in danger. What you do next will shape your relationship with the spirit world.", lineOrder: 3 },
      ],
      choices: [
        { id: 6, choiceText: "\"Send men to retrieve it. Power is power.\"",               nextSceneId: 7, flagKey: "supernatural_affinity", flagValue: 2,  flagKey2: null,                    flagValue2: null, choiceOrder: 1 },
        { id: 7, choiceText: "\"Destroy it. Superstition breeds weakness in my men.\"",    nextSceneId: 8, flagKey: "supernatural_affinity", flagValue: -1, flagKey2: "mitsuhide_loyalty", flagValue2: 1,    choiceOrder: 2 },
      ],
    },
    {
      id: 7, sceneOrder: 7, backgroundKey: "owari_castle_armory_night", bgmKey: "bgm_ominous",
      nextSceneId: 9, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 19, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,                   text: "The sword arrives wrapped in black silk. Your men refuse to touch it. You pick it up yourself.", lineOrder: 1 },
        { id: 20, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_intrigued",   text: "It hums. Like recognition.", lineOrder: 2 },
        { id: 21, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,                   text: "Something stirs at the edge of your mind. Ancient. Patient. Hungry.", lineOrder: 3 },
      ],
      choices: [],
    },
    {
      id: 8, sceneOrder: 8, backgroundKey: "nagashino_ruins_ash", bgmKey: "bgm_resolve",
      nextSceneId: 9, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 22, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,                    text: "The blade is destroyed. The monk bows deeply. Mitsuhide stands at your shoulder, watching.", lineOrder: 1 },
        { id: 23, speakerName: "Mitsuhide", speakerSide: "left",  portraitKey: "mitsuhide_approving",   text: "A wise decision, my lord. A blade that kills its bearers serves no one.", lineOrder: 2 },
      ],
      choices: [],
    },
    {
      id: 9, sceneOrder: 9, backgroundKey: "owari_border_storm", bgmKey: "bgm_war_drums",
      nextSceneId: null, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 24, speakerName: "Scout",     speakerSide: "left",  portraitKey: "scout_panicked",   text: "25,000 men, my lord. Imagawa Yoshimoto marches for Kyoto. He passes through Owari like we don't exist.", lineOrder: 1 },
        { id: 25, speakerName: "Mitsuhide", speakerSide: "left",  portraitKey: "mitsuhide_grave",  text: "We have 2,000. This is not a battle. This is an execution.", lineOrder: 2 },
        { id: 26, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_fierce",  text: "Or an opportunity. Storms are loud. Scouts go blind. 25,000 men cannot all watch at once.", lineOrder: 3 },
      ],
      choices: [
        { id: 8, choiceText: "\"Strike now — full ambush in the storm. No hesitation.\"",    nextSceneId: 10, flagKey: "ruthlessness",    flagValue: 2, flagKey2: null, flagValue2: null, choiceOrder: 1 },
        { id: 9, choiceText: "\"Send a decoy force to draw attention. We flank quietly.\"",   nextSceneId: 10, flagKey: "political_power", flagValue: 1, flagKey2: null, flagValue2: null, choiceOrder: 2 },
      ],
    },
    {
      id: 10, sceneOrder: 10, backgroundKey: "okehazama_gorge_storm", bgmKey: "bgm_war_drums",
      nextSceneId: null, isBattleGate: true, battleEnemyKey: "imagawa_vanguard",
      battleWinSceneId: 11, battleLoseSceneId: 12, isChapterEnd: false,
      dialogueLines: [
        { id: 27, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,              text: "The storm breaks. Lightning splits the sky over Okehazama gorge. Yoshimoto rests in his palanquin, certain no fool would attack in this weather.", lineOrder: 1 },
        { id: 28, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_fierce", text: "Move.", lineOrder: 2 },
      ],
      choices: [],
    },
    {
      id: 11, sceneOrder: 11, backgroundKey: "okehazama_aftermath_dawn", bgmKey: "bgm_victory_somber",
      nextSceneId: 13, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 29, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,                   text: "Yoshimoto is dead. His head is in your hands. 25,000 men scatter like smoke in the morning wind.", lineOrder: 1 },
        { id: 30, speakerName: "Mitsuhide", speakerSide: "left",  portraitKey: "mitsuhide_disbelief",  text: "...How.", lineOrder: 2 },
        { id: 31, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_smirk",       text: "They were waiting for a battle. I gave them a storm.", lineOrder: 3 },
      ],
      choices: [],
    },
    {
      id: 12, sceneOrder: 12, backgroundKey: "owari_castle_night_rain", bgmKey: "bgm_defeat",
      nextSceneId: 13, isBattleGate: false, isChapterEnd: false,
      dialogueLines: [
        { id: 32, speakerName: "Narrator",  speakerSide: "none",  portraitKey: null,              text: "The ambush fails. You retreat through the storm, wounded. Yoshimoto marches on, laughing at the Fool of Owari.", lineOrder: 1 },
        { id: 33, speakerName: "Mitsuhide", speakerSide: "left",  portraitKey: "mitsuhide_grim",  text: "We live. That is enough for today, my lord.", lineOrder: 2 },
        { id: 34, speakerName: "Nobunaga",  speakerSide: "right", portraitKey: "nobunaga_cold",   text: "No. It is not enough. It will never be enough.", lineOrder: 3 },
      ],
      choices: [],
    },
    {
      id: 13, sceneOrder: 13, backgroundKey: "owari_castle_night", bgmKey: "bgm_tension_resolve",
      nextSceneId: null, isBattleGate: false, isChapterEnd: true,
      dialogueLines: [
        { id: 35, speakerName: "Messenger",      speakerSide: "left",  portraitKey: "messenger_formal", text: "My lord. A letter. Seal of the Uesugi clan.", lineOrder: 1 },
        { id: 36, speakerName: "Narrator",       speakerSide: "none",  portraitKey: null,               text: "You break the seal. The handwriting is precise. Controlled. The hand of a man who has never doubted himself.", lineOrder: 2 },
        { id: 37, speakerName: "Kenshin (letter)", speakerSide: "left", portraitKey: "kenshin_portrait", text: "The Fool of Owari has teeth. Interesting. We will meet, and I will judge whether you are a sword worth fearing — or a plague to be ended.", lineOrder: 3 },
        { id: 38, speakerName: "Nobunaga",       speakerSide: "right", portraitKey: "nobunaga_smirk",   text: "Tell him I look forward to his judgment.", lineOrder: 4 },
        { id: 39, speakerName: "Narrator",       speakerSide: "none",  portraitKey: null,               text: "The first step is taken. Japan watches. The age of the Fool of Owari has begun.", lineOrder: 5 },
      ],
      choices: [],
    },
  ],
};

/** Returns chapter data. Phase 5: replace body with fetch('/api/story/chapters/id'). */
export async function fetchChapter(chapterId: number): Promise<ChapterData> {
  if (chapterId === 1) return CHAPTER_1;
  throw new Error(`Chapter ${chapterId} not yet available.`);
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function startChapter(
  chapterId: number,
  firstSceneId: number,
  forceRestart = false,
): Promise<ProgressState> {
  const existing = read<ProgressState | null>(KEYS.progress, null);
  if (existing && existing.chapterId === chapterId && !forceRestart) return existing;
  const fresh: ProgressState = {
    chapterId,
    currentSceneId: firstSceneId,
    isCompleted: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  write(KEYS.progress, fresh);
  return fresh;
}

export async function advanceScene(nextSceneId: number): Promise<ProgressState> {
  const progress = read<ProgressState | null>(KEYS.progress, null);
  if (!progress) throw new Error("No active chapter. Call startChapter first.");
  const updated: ProgressState = { ...progress, currentSceneId: nextSceneId };
  write(KEYS.progress, updated);
  return updated;
}

export async function completeChapter(): Promise<ProgressState> {
  const progress = read<ProgressState | null>(KEYS.progress, null);
  if (!progress) throw new Error("No active chapter.");
  const updated: ProgressState = { ...progress, isCompleted: true, completedAt: new Date().toISOString() };
  write(KEYS.progress, updated);
  return updated;
}

export async function getProgress(): Promise<ProgressState | null> {
  return read<ProgressState | null>(KEYS.progress, null);
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export async function applyFlags(mutations: Partial<StoryFlags>): Promise<StoryFlags> {
  const flags = read<StoryFlags>(KEYS.flags, {});
  for (const [key, delta] of Object.entries(mutations)) {
    flags[key] = (flags[key] ?? 0) + (delta ?? 0);
  }
  write(KEYS.flags, flags);
  return flags;
}

export async function getFlags(): Promise<StoryFlags> {
  return read<StoryFlags>(KEYS.flags, {});
}

export async function getFlag(key: string): Promise<number> {
  const flags = read<StoryFlags>(KEYS.flags, {});
  return flags[key] ?? 0;
}

// ─── Seen scenes ──────────────────────────────────────────────────────────────

export async function markSceneSeen(sceneId: number): Promise<void> {
  const seen = read<number[]>(KEYS.seen, []);
  if (!seen.includes(sceneId)) { seen.push(sceneId); write(KEYS.seen, seen); }
}

export async function hasSeenScene(sceneId: number): Promise<boolean> {
  return read<number[]>(KEYS.seen, []).includes(sceneId);
}

export async function getSeenSceneIds(): Promise<number[]> {
  return read<number[]>(KEYS.seen, []);
}

// ─── Endings ──────────────────────────────────────────────────────────────────

export async function unlockEnding(
  ending: Omit<UnlockedEnding, "unlockedAt"> & { chapterId?: number },
): Promise<UnlockedEnding> {
  const endings = read<UnlockedEnding[]>(KEYS.endings, []);
  const existing = endings.find((e) => e.endingKey === ending.endingKey);
  if (existing) return existing;
  const record: UnlockedEnding = {
    endingKey: ending.endingKey,
    endingTitle: ending.endingTitle,
    endingDescription: ending.endingDescription,
    unlockedAt: new Date().toISOString(),
  };
  endings.push(record);
  write(KEYS.endings, endings);
  return record;
}

export async function getUnlockedEndings(): Promise<UnlockedEnding[]> {
  return read<UnlockedEnding[]>(KEYS.endings, []);
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export async function getSnapshot(): Promise<StoryEngineSnapshot> {
  return {
    progress:     read<ProgressState | null>(KEYS.progress, null),
    flags:        read<StoryFlags>(KEYS.flags, {}),
    seenSceneIds: read<number[]>(KEYS.seen, []),
    endings:      read<UnlockedEnding[]>(KEYS.endings, []),
  };
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export async function resetStory(): Promise<void> {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export async function resetFlagsAndSeen(): Promise<void> {
  localStorage.removeItem(KEYS.flags);
  localStorage.removeItem(KEYS.seen);
}
