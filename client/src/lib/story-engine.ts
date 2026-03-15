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
 *   sengoku_story_flags     → StoryFlags
 *   sengoku_story_seen      → number[]
 *   sengoku_story_endings   → UnlockedEnding[]
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

// ─── Storage keys ───────────────────────────────────────────────────────────────

const KEYS = {
  progress: "sengoku_story_progress",
  flags:    "sengoku_story_flags",
  seen:     "sengoku_story_seen",
  endings:  "sengoku_story_endings",
} as const;

// ─── Low-level helpers ────────────────────────────────────────────────────────────

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

// ─── Chapter data types ──────────────────────────────────────────────────────────

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

// ─── fetchChapter ───────────────────────────────────────────────────────────────
//
// Phase 5 swap: call the real API so ALL authored chapters are available.
// The server endpoint GET /api/story/chapters/:id reads from the DB and
// returns the full chapter with scenes + dialogue + choices.
//
// Cookies are included automatically (same-origin) so the session auth
// header is not needed explicitly.

export async function fetchChapter(chapterId: number): Promise<ChapterData> {
  const res = await fetch(`/api/story/chapters/${chapterId}`, {
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Chapter ${chapterId} not yet available.`);
    }
    throw new Error(`Failed to load chapter ${chapterId}: ${res.status}`);
  }
  return res.json() as Promise<ChapterData>;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export async function startChapter(
  chapterId: number,
  firstSceneId: number,
  forceRestart = false,
): Promise<ProgressState> {
  const existing = read<ProgressState | null>(KEYS.progress, null);
  if (existing && existing.chapterId === chapterId && !forceRestart) return existing;

  // Clear stale flags/seen whenever writing a fresh chapter start.
  localStorage.removeItem(KEYS.flags);
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

// ─── Seen scenes ────────────────────────────────────────────────────────────────

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

// ─── Endings ───────────────────────────────────────────────────────────────────

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

// ─── Snapshot ────────────────────────────────────────────────────────────────

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
