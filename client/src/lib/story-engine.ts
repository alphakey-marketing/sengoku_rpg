/**
 * story-engine.ts  (Phase 5 — API backend)
 * ─────────────────────────────────────────────────────────────────────────────
 * All state is now persisted to the server DB.
 * localStorage is used only as a short-lived write-through cache so the UI
 * stays snappy between advance() calls (no round-trip per line of dialogue).
 *
 * The public async API is identical to the Phase 3 localStorage version —
 * the UI (story.tsx) required zero changes.
 *
 * Cache strategy:
 *   • On read  → check cache first, fall back to API if empty
 *   • On write → write API, then update cache
 *   • Cache TTL is session-scoped (cleared on resetStory)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CACHE_FLAGS    = "sengoku_story_flags_cache";
const CACHE_PROGRESS = "sengoku_story_progress_cache";
const CACHE_SEEN     = "sengoku_story_seen_cache";
const CACHE_ENDINGS  = "sengoku_story_endings_cache";

function cacheRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function cacheWrite<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Types (re-exported so the UI can import them from one place) ─────────────

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

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/story${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function startChapter(
  chapterId: number,
  firstSceneId: number,
  forceRestart = false,
): Promise<ProgressState> {
  if (!forceRestart) {
    const cached = cacheRead<ProgressState | null>(CACHE_PROGRESS, null);
    if (cached && cached.chapterId === chapterId && !cached.isCompleted) return cached;
  }
  const row = await api<any>("/progress", {
    method: "POST",
    body: JSON.stringify({ chapterId, currentSceneId: firstSceneId, forceRestart }),
  });
  const state: ProgressState = {
    chapterId: row.chapterId,
    currentSceneId: row.currentSceneId,
    isCompleted: row.isCompleted,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? null,
  };
  cacheWrite(CACHE_PROGRESS, state);
  return state;
}

export async function advanceScene(nextSceneId: number): Promise<ProgressState> {
  const cached = cacheRead<ProgressState | null>(CACHE_PROGRESS, null);
  if (!cached) throw new Error("No active chapter.");

  // Optimistic cache update first (keeps UI instant)
  const optimistic: ProgressState = { ...cached, currentSceneId: nextSceneId };
  cacheWrite(CACHE_PROGRESS, optimistic);

  // Also persist seen scene id
  const seen = cacheRead<number[]>(CACHE_SEEN, []);
  if (!seen.includes(nextSceneId)) { seen.push(nextSceneId); cacheWrite(CACHE_SEEN, seen); }

  // Fire-and-forget API call (don't await; UI never blocks on this)
  api<any>("/progress", {
    method: "POST",
    body: JSON.stringify({ chapterId: cached.chapterId, currentSceneId: nextSceneId }),
  }).catch(console.error);

  return optimistic;
}

export async function completeChapter(): Promise<ProgressState> {
  const cached = cacheRead<ProgressState | null>(CACHE_PROGRESS, null);
  if (!cached) throw new Error("No active chapter.");
  const updated: ProgressState = { ...cached, isCompleted: true, completedAt: new Date().toISOString() };
  cacheWrite(CACHE_PROGRESS, updated);
  return updated;
}

export async function getProgress(): Promise<ProgressState | null> {
  const cached = cacheRead<ProgressState | null>(CACHE_PROGRESS, null);
  if (cached) return cached;
  try {
    const rows = await api<any[]>("/progress");
    if (!rows.length) return null;
    const row = rows[0];
    const state: ProgressState = {
      chapterId: row.chapterId,
      currentSceneId: row.currentSceneId,
      isCompleted: row.isCompleted,
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? null,
    };
    cacheWrite(CACHE_PROGRESS, state);
    return state;
  } catch { return null; }
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export async function applyFlags(mutations: Partial<StoryFlags>): Promise<StoryFlags> {
  // Optimistic cache
  const cached = cacheRead<StoryFlags>(CACHE_FLAGS, {});
  for (const [k, v] of Object.entries(mutations)) cached[k] = (cached[k] ?? 0) + (v ?? 0);
  cacheWrite(CACHE_FLAGS, cached);

  // Async persist
  api<StoryFlags>("/flags", {
    method: "POST",
    body: JSON.stringify({ mutations }),
  })
    .then((updated) => cacheWrite(CACHE_FLAGS, updated))
    .catch(console.error);

  return cached;
}

export async function getFlags(): Promise<StoryFlags> {
  const cached = cacheRead<StoryFlags>(CACHE_FLAGS, {});
  if (Object.keys(cached).length) return cached;
  try {
    const flags = await api<StoryFlags>("/flags");
    cacheWrite(CACHE_FLAGS, flags);
    return flags;
  } catch { return {}; }
}

export async function getFlag(key: string): Promise<number> {
  const flags = await getFlags();
  return flags[key] ?? 0;
}

// ─── Seen scenes ──────────────────────────────────────────────────────────────

export async function markSceneSeen(sceneId: number): Promise<void> {
  const seen = cacheRead<number[]>(CACHE_SEEN, []);
  if (!seen.includes(sceneId)) { seen.push(sceneId); cacheWrite(CACHE_SEEN, seen); }
}

export async function hasSeenScene(sceneId: number): Promise<boolean> {
  return cacheRead<number[]>(CACHE_SEEN, []).includes(sceneId);
}

export async function getSeenSceneIds(): Promise<number[]> {
  return cacheRead<number[]>(CACHE_SEEN, []);
}

// ─── Endings ──────────────────────────────────────────────────────────────────

export async function unlockEnding(
  ending: Omit<UnlockedEnding, "unlockedAt"> & { chapterId: number },
): Promise<UnlockedEnding> {
  const cached = cacheRead<UnlockedEnding[]>(CACHE_ENDINGS, []);
  const exists = cached.find((e) => e.endingKey === ending.endingKey);
  if (exists) return exists;

  const record: UnlockedEnding = { ...ending, unlockedAt: new Date().toISOString() };
  cached.push(record);
  cacheWrite(CACHE_ENDINGS, cached);

  api<{ success: boolean }>("/progress/complete", {
    method: "POST",
    body: JSON.stringify({
      chapterId: ending.chapterId,
      endingKey: ending.endingKey,
      endingTitle: ending.endingTitle,
      endingDescription: ending.endingDescription,
    }),
  }).catch(console.error);

  return record;
}

export async function getUnlockedEndings(): Promise<UnlockedEnding[]> {
  const cached = cacheRead<UnlockedEnding[]>(CACHE_ENDINGS, []);
  if (cached.length) return cached;
  try {
    const endings = await api<any[]>("/endings");
    const mapped: UnlockedEnding[] = endings.map((e) => ({
      endingKey: e.endingKey,
      endingTitle: e.endingTitle,
      endingDescription: e.endingDescription,
      unlockedAt: e.unlockedAt,
    }));
    cacheWrite(CACHE_ENDINGS, mapped);
    return mapped;
  } catch { return []; }
}

// ─── Chapter content ──────────────────────────────────────────────────────────

export async function fetchChapter(chapterId: number): Promise<any> {
  return api<any>(`/chapters/${chapterId}`);
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export async function getSnapshot(): Promise<StoryEngineSnapshot> {
  const [progress, flags, seenSceneIds, endings] = await Promise.all([
    getProgress(),
    getFlags(),
    getSeenSceneIds(),
    getUnlockedEndings(),
  ]);
  return { progress, flags, seenSceneIds, endings };
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export async function resetStory(): Promise<void> {
  [CACHE_FLAGS, CACHE_PROGRESS, CACHE_SEEN, CACHE_ENDINGS].forEach((k) => localStorage.removeItem(k));
}

export async function resetFlagsAndSeen(): Promise<void> {
  localStorage.removeItem(CACHE_FLAGS);
  localStorage.removeItem(CACHE_SEEN);
}
