/**
 * story-engine.ts  (Phase 5 — API-backed fetchChapter)
 * ──────────────────────────────────────────────────────────────────────────────
 * localStorage state manager + live API chapter loader.
 *
 * All state (progress, flags, seen scenes, endings) remains in localStorage
 * so the phase-3 session model is unchanged. Only fetchChapter() now goes
 * to the server, enabling all authored chapters to be played.
 *
 * Storage keys (prefix: "sengoku_story_")
 *   sengoku_story_progress  → ProgressState
 *   sengoku_story_flags     → StoryFlags   ← persists across ALL chapters
 *   sengoku_story_seen      → number[]
 *   sengoku_story_endings   → UnlockedEnding[]
 *
 * Sprint 4 (1a): DialogueLine.grantHintKey added — optional nullable string
 * passed through from the DB column.  StoryPlayer uses it to conditionally
 * apply an amber shimmer underline to the speaker name label.
 */

import { apiRequest } from "./queryClient";

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

// ─── Flag condition + write types ─────────────────────────────────────────────

export interface FlagCondition {
  flagKey: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value: number;
}

export interface FlagWrite {
  flagKey: string;
  flagValue: number;
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

// ─── Chapter data types ───────────────────────────────────────────────────────

export interface DialogueLine {
  id:          number;
  speakerName: string;
  speakerSide: "left" | "right" | "none";
  portraitKey: string | null;
  text:        string;
  lineOrder:   number;
  /**
   * Sprint 4 (1a) — Dialogue Grant Hint Shimmer
   *
   * Optional stable grant key set by scene writers (e.g. "ch2_nohime_sword").
   * When present, StoryPlayer renders a 2px amber shimmer underline on the
   * speaker name label — a subtle cue that this line carries a grant
   * consequence.  null / undefined → no shimmer.
   */
  grantHintKey?: string | null;
}

export interface Choice {
  id:          number;
  choiceText:  string;
  nextSceneId: number;
  flagKey:     string | null;
  flagValue:   number | null;
  flagKey2:    string | null;
  flagValue2:  number | null;
  choiceOrder: number;
}

export interface Scene {
  id:                number;
  sceneOrder:        number;
  backgroundKey:     string;
  bgmKey:            string;
  nextSceneId:       number | null;
  isBattleGate:      boolean;
  battleEnemyKey?:   string | null;
  battleWinSceneId?: number | null;
  battleLoseSceneId?: number | null;
  isChapterEnd:      boolean;
  dialogueLines:     DialogueLine[];
  choices:           Choice[];
  flagCondition?:    FlagCondition | null;
  flagWrites?:       FlagWrite[] | null;
}

export interface ChapterData {
  id:           number;
  title:        string;
  subtitle:     string | null;
  firstSceneId: number | null;
  isLocked:     boolean;
  scenes:       Scene[];
}

// ─── fetchChapter ─────────────────────────────────────────────────────────────

export async function fetchChapter(chapterId: number): Promise<ChapterData> {
  let data: ChapterData;
  try {
    data = await apiRequest("GET", `/api/story/chapters/${chapterId}`);
  } catch (err: any) {
    if (typeof err?.message === "string" && err.message.startsWith("404")) {
      throw new Error(`Chapter ${chapterId} not yet available.`);
    }
    throw new Error(`Failed to load chapter ${chapterId}: ${err?.message ?? err}`);
  }

  if (!data.scenes || data.scenes.length === 0) {
    throw new Error(`Chapter ${chapterId} not yet available.`);
  }

  return data;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function startChapter(
  chapterId: number,
  firstSceneId: number,
  forceRestart = false,
): Promise<ProgressState> {
  const existing = read<ProgressState | null>(KEYS.progress, null);
  if (existing && existing.chapterId === chapterId && !forceRestart) return existing;

  if (forceRestart) {
    localStorage.removeItem(KEYS.flags);
  }

  localStorage.removeItem(KEYS.seen);

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

  apiRequest("POST", "/api/story/progress", {
    chapterId: progress.chapterId,
    currentSceneId: nextSceneId,
  }).catch(() => {});

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
  for (const [key, value] of Object.entries(mutations)) {
    flags[key] = (flags[key] ?? 0) + (value ?? 0);
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

// ─── Flag condition evaluation ────────────────────────────────────────────────

export function evaluateFlagCondition(
  condition: FlagCondition | null | undefined,
  flags: StoryFlags,
): boolean {
  if (!condition) return true;
  const actual = flags[condition.flagKey] ?? 0;
  switch (condition.operator) {
    case "eq":  return actual === condition.value;
    case "neq": return actual !== condition.value;
    case "gt":  return actual >   condition.value;
    case "gte": return actual >=  condition.value;
    case "lt":  return actual <   condition.value;
    case "lte": return actual <=  condition.value;
    default:    return true;
  }
}

export function resolveConditionalScene(
  candidates: Scene[],
  flags: StoryFlags,
): Scene | null {
  for (const scene of candidates) {
    if (scene.flagCondition && evaluateFlagCondition(scene.flagCondition, flags)) {
      return scene;
    }
  }
  return candidates.find((s) => !s.flagCondition) ?? null;
}

// ─── Scene-level flag writes ──────────────────────────────────────────────────

export async function applySceneFlagWrites(scene: Scene): Promise<StoryFlags> {
  if (!scene.flagWrites || scene.flagWrites.length === 0) {
    return getFlags();
  }
  const mutations: Partial<StoryFlags> = {};
  for (const fw of scene.flagWrites) {
    mutations[fw.flagKey] = fw.flagValue;
  }
  return applyFlags(mutations);
}

// ─── Seen scenes ──────────────────────────────────────────────────────────────

export async function markSceneSeen(sceneId: number): Promise<void> {
  const seen = read<number[]>(KEYS.seen, []);
  if (!seen.includes(sceneId)) { seen.push(sceneId); write(KEYS.seen, seen); }
}

// ─── Endings ──────────────────────────────────────────────────────────────────

export async function unlockEnding(
  ending: Omit<UnlockedEnding, "unlockedAt"> & { chapterId?: number },
): Promise<UnlockedEnding> {
  const endings = read<UnlockedEnding[]>(KEYS.endings, []);
  const existing = endings.find((e) => e.endingKey === ending.endingKey);
  if (existing) return existing;
  const record: UnlockedEnding = {
    endingKey:         ending.endingKey,
    endingTitle:       ending.endingTitle,
    endingDescription: ending.endingDescription,
    unlockedAt:        new Date().toISOString(),
  };
  endings.push(record);
  write(KEYS.endings, record);
  return record;
}

export async function getUnlockedEndings(): Promise<UnlockedEnding[]> {
  return read<UnlockedEnding[]>(KEYS.endings, []);
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export async function resetStory(): Promise<void> {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
