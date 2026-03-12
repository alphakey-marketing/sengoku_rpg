/**
 * story-engine.ts
 * ─────────────────────────────────────────────────────────────
 * localStorage-first VN story state manager.
 *
 * Responsibilities:
 *   • Track the player's current chapter + scene
 *   • Accumulate story flags (ruthlessness, political_power, …)
 *   • Record which scenes have been seen (for skip / fast-forward)
 *   • Store unlocked endings
 *   • Expose a clean API that will be swapped for real API calls in Phase 5
 *     — every public function is async so the signature never changes.
 *
 * Storage layout  (all keys prefixed with "sengoku_story_")
 *   sengoku_story_progress    → ProgressState (JSON)
 *   sengoku_story_flags       → Record<string, number> (JSON)
 *   sengoku_story_seen        → number[]  (JSON array of scene IDs)
 *   sengoku_story_endings     → UnlockedEnding[] (JSON)
 * ─────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────

export interface ProgressState {
  chapterId: number;
  currentSceneId: number | null;
  isCompleted: boolean;
  startedAt: string;        // ISO timestamp
  completedAt: string | null;
}

export interface StoryFlags {
  [flagKey: string]: number;
}

export interface UnlockedEnding {
  endingKey: string;
  endingTitle: string;
  endingDescription: string;
  unlockedAt: string;       // ISO timestamp
}

export interface StoryEngineSnapshot {
  progress: ProgressState | null;
  flags: StoryFlags;
  seenSceneIds: number[];
  endings: UnlockedEnding[];
}

// ─── Storage keys ─────────────────────────────────────────────

const KEYS = {
  progress: "sengoku_story_progress",
  flags:    "sengoku_story_flags",
  seen:     "sengoku_story_seen",
  endings:  "sengoku_story_endings",
} as const;

// ─── Low-level helpers ─────────────────────────────────────────

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

// ─── Progress ─────────────────────────────────────────────────

/**
 * Begin or resume a chapter.
 * Call this when the player clicks "Play" on Chapter N.
 * If a progress record already exists for this chapter it is returned as-is
 * (resume semantics). Pass `forceRestart = true` to start from scratch.
 */
export async function startChapter(
  chapterId: number,
  firstSceneId: number,
  forceRestart = false,
): Promise<ProgressState> {
  const existing = read<ProgressState | null>(KEYS.progress, null);

  if (existing && existing.chapterId === chapterId && !forceRestart) {
    return existing;
  }

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

/** Advance to the next scene. */
export async function advanceScene(
  nextSceneId: number,
): Promise<ProgressState> {
  const progress = read<ProgressState | null>(KEYS.progress, null);
  if (!progress) throw new Error("No active chapter. Call startChapter first.");

  const updated: ProgressState = { ...progress, currentSceneId: nextSceneId };
  write(KEYS.progress, updated);
  return updated;
}

/** Mark the current chapter as completed. */
export async function completeChapter(): Promise<ProgressState> {
  const progress = read<ProgressState | null>(KEYS.progress, null);
  if (!progress) throw new Error("No active chapter.");

  const updated: ProgressState = {
    ...progress,
    isCompleted: true,
    completedAt: new Date().toISOString(),
  };

  write(KEYS.progress, updated);
  return updated;
}

/** Read current progress without modifying it. */
export async function getProgress(): Promise<ProgressState | null> {
  return read<ProgressState | null>(KEYS.progress, null);
}

// ─── Flags ────────────────────────────────────────────────────

/**
 * Apply one or two flag mutations from a choice.
 * Values are additive — calling applyFlags({ ruthlessness: 1 }) twice
 * results in ruthlessness = 2.
 */
export async function applyFlags(
  mutations: Partial<StoryFlags>,
): Promise<StoryFlags> {
  const flags = read<StoryFlags>(KEYS.flags, {});

  for (const [key, delta] of Object.entries(mutations)) {
    flags[key] = (flags[key] ?? 0) + (delta ?? 0);
  }

  write(KEYS.flags, flags);
  return flags;
}

/** Read all current flags. */
export async function getFlags(): Promise<StoryFlags> {
  return read<StoryFlags>(KEYS.flags, {});
}

/** Read a single flag value (0 if never set). */
export async function getFlag(key: string): Promise<number> {
  const flags = read<StoryFlags>(KEYS.flags, {});
  return flags[key] ?? 0;
}

// ─── Seen scenes ──────────────────────────────────────────────

/** Mark a scene as seen. Idempotent — safe to call on every render. */
export async function markSceneSeen(sceneId: number): Promise<void> {
  const seen = read<number[]>(KEYS.seen, []);
  if (!seen.includes(sceneId)) {
    seen.push(sceneId);
    write(KEYS.seen, seen);
  }
}

/** Returns true if the player has already seen this scene. */
export async function hasSeenScene(sceneId: number): Promise<boolean> {
  const seen = read<number[]>(KEYS.seen, []);
  return seen.includes(sceneId);
}

/** Read the full array of seen scene IDs. */
export async function getSeenSceneIds(): Promise<number[]> {
  return read<number[]>(KEYS.seen, []);
}

// ─── Endings ──────────────────────────────────────────────────

/** Record an ending the player has reached. Idempotent by endingKey. */
export async function unlockEnding(
  ending: Omit<UnlockedEnding, "unlockedAt">,
): Promise<UnlockedEnding> {
  const endings = read<UnlockedEnding[]>(KEYS.endings, []);
  const existing = endings.find((e) => e.endingKey === ending.endingKey);
  if (existing) return existing;

  const record: UnlockedEnding = {
    ...ending,
    unlockedAt: new Date().toISOString(),
  };

  endings.push(record);
  write(KEYS.endings, endings);
  return record;
}

/** Read all unlocked endings. */
export async function getUnlockedEndings(): Promise<UnlockedEnding[]> {
  return read<UnlockedEnding[]>(KEYS.endings, []);
}

// ─── Full snapshot ────────────────────────────────────────────

/** Return a complete snapshot of all story state (useful for debug/save-export). */
export async function getSnapshot(): Promise<StoryEngineSnapshot> {
  return {
    progress: read<ProgressState | null>(KEYS.progress, null),
    flags:    read<StoryFlags>(KEYS.flags, {}),
    seenSceneIds: read<number[]>(KEYS.seen, []),
    endings:  read<UnlockedEnding[]>(KEYS.endings, []),
  };
}

// ─── Reset ────────────────────────────────────────────────────

/** Wipe all story state. Use for "New Game" or dev resets. */
export async function resetStory(): Promise<void> {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

/** Wipe only flags + seen (keep progress). Used for chapter replay. */
export async function resetFlagsAndSeen(): Promise<void> {
  localStorage.removeItem(KEYS.flags);
  localStorage.removeItem(KEYS.seen);
}
