/**
 * server/seed-story-chapters.ts
 *
 * Auto-seeds story chapters from script/story/chapter_XX.json into the DB
 * on every server startup. Idempotent — skips any chapter already present.
 *
 * Called from server/index.ts between runMigrations() and route registration.
 *
 * FILE NAMING CONTRACT
 * --------------------
 * Only files matching `chapter_*.json` are processed. Other JSON files in the
 * same directory (e.g. flag-registry.json) are intentionally ignored.
 *
 * Sprint 4 (1a): JsonDialogueLine now accepts optional grantHintKey so scene
 * writers can annotate individual lines in chapter JSON files:
 *
 *   { "grantHintKey": "ch2_nohime_sword" }
 *
 * The value is passed straight through to dialogue_lines.grant_hint_key.
 */

import { readFile, readdir } from "fs/promises";
import { resolve, join } from "path";
import { db } from "./db";
import {
  storyChapters,
  storyScenes,
  dialogueLines,
  storyChoices,
  type ConditionalVariant,
  type SceneFlagWrite,
} from "../shared/schema";
import { eq } from "drizzle-orm";

// ─── JSON file types ───────────────────────────────────────────────────────────

interface JsonDialogueLine {
  speakerName: string;
  speakerSide: string;
  portraitKey: string | null;
  text: string;
  lineOrder: number;
  /**
   * Sprint 4 (1a) — Dialogue Grant Hint Shimmer
   *
   * Optional field. Scene writers add this key to any dialogue line whose
   * speaker is about to trigger a story grant, e.g.:
   *
   *   "grantHintKey": "ch2_nohime_sword"
   *
   * StoryPlayer renders a 2 px amber shimmer underline on the speaker name
   * label for that line — a subtle visual cue only.  No item is revealed.
   *
   * Absent / null → NULL stored in DB → no shimmer rendered.
   */
  grantHintKey?: string | null;
}

interface JsonChoice {
  choiceText: string;
  nextSceneRef: string;
  flagKey: string | null;
  flagValue: number | null;
  flagKey2: string | null;
  flagValue2: number | null;
  choiceOrder: number;
}

interface JsonConditionalVariantCondition {
  flagKey: string;
  operator: "gte" | "lte" | "gt" | "lt" | "eq" | "neq";
  value: number;
}

interface JsonConditionalVariant {
  outcome: "win" | "lose";
  sceneRef: string;
  condition: JsonConditionalVariantCondition;
}

/**
 * JsonFlagWrite — one unconditional additive flag mutation declared at scene level.
 *
 * Mirrors SceneFlagWrite from shared/schema.ts but lives here separately so the
 * seeder's JSON interface types stay self-contained and don't import runtime schema.
 *
 * flagValue is a delta (not an absolute set): +1 increments, -1 decrements.
 * Stored in story_scenes.flag_writes JSONB and applied by POST /api/story/progress
 * when the player advances to this scene.
 */
interface JsonFlagWrite {
  flagKey:   string;
  flagValue: number;
}

interface JsonScene {
  sceneRef: string;
  backgroundKey: string;
  bgmKey: string;
  sceneOrder: number;
  nextSceneRef: string | null;
  isBattleGate: boolean;
  battleEnemyKey?: string;
  battleWinSceneRef?: string;
  battleLoseSceneRef?: string;
  conditionalVariants?: JsonConditionalVariant[];
  /**
   * Optional array of unconditional flag mutations that fire when the
   * player advances to this scene, regardless of choices made.
   *
   * Example (S06A — blade retrieved at Nagashino):
   *   "flagWrites": [
   *     { "flagKey": "weapon_legacy", "flagValue": 1 },
   *     { "flagKey": "omen_read",     "flagValue": 1 }
   *   ]
   *
   * Stored as-is in story_scenes.flag_writes JSONB.
   * Absent or empty array → null stored in DB (no-op at runtime).
   */
  flagWrites?: JsonFlagWrite[];
  isChapterEnd: boolean;
  dialogueLines: JsonDialogueLine[];
  choices: JsonChoice[];
}

interface JsonChapterFile {
  chapter: {
    title: string;
    subtitle: string;
    chapterOrder: number;
    isLocked: boolean;
  };
  scenes: JsonScene[];
}

/** Type-guard: returns true if the parsed JSON looks like a valid chapter file. */
function isValidChapterFile(data: unknown): data is JsonChapterFile {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.chapter === "object" &&
    d.chapter !== null &&
    typeof (d.chapter as Record<string, unknown>).title === "string" &&
    Array.isArray(d.scenes)
  );
}

// ─── Core seed logic ───────────────────────────────────────────────────────────

async function buildRefMap(
  scenes: JsonScene[],
  chapterId: number,
): Promise<Map<string, number>> {
  const refMap = new Map<string, number>();
  for (const s of scenes) {
    const flagWrites: SceneFlagWrite[] | null =
      s.flagWrites && s.flagWrites.length > 0
        ? s.flagWrites.map((fw) => ({ flagKey: fw.flagKey, flagValue: fw.flagValue }))
        : null;

    const [inserted] = await db
      .insert(storyScenes)
      .values({
        chapterId,
        backgroundKey: s.backgroundKey,
        bgmKey: s.bgmKey,
        sceneOrder: s.sceneOrder,
        isBattleGate: s.isBattleGate,
        battleEnemyKey: s.battleEnemyKey ?? null,
        isChapterEnd: s.isChapterEnd,
        flagWrites,
      })
      .returning({ id: storyScenes.id });
    refMap.set(s.sceneRef, inserted.id);
  }
  return refMap;
}

async function resolveForwardRefs(
  scenes: JsonScene[],
  refMap: Map<string, number>,
): Promise<void> {
  for (const s of scenes) {
    const sceneId = refMap.get(s.sceneRef)!;

    let resolvedVariants: ConditionalVariant[] | null = null;
    if (s.conditionalVariants && s.conditionalVariants.length > 0) {
      resolvedVariants = s.conditionalVariants
        .map((v): ConditionalVariant | null => {
          const resolvedSceneId = refMap.get(v.sceneRef);
          if (resolvedSceneId === undefined) {
            console.warn(
              `[seed-story] WARNING: conditionalVariant sceneRef "${v.sceneRef}" ` +
              `not found in refMap for scene "${s.sceneRef}". Skipping variant.`,
            );
            return null;
          }
          return {
            outcome:   v.outcome,
            sceneId:   resolvedSceneId,
            condition: v.condition,
          };
        })
        .filter((v): v is ConditionalVariant => v !== null);
    }

    await db
      .update(storyScenes)
      .set({
        nextSceneId:         s.nextSceneRef       ? (refMap.get(s.nextSceneRef)       ?? null) : null,
        battleWinSceneId:    s.battleWinSceneRef  ? (refMap.get(s.battleWinSceneRef)  ?? null) : null,
        battleLoseSceneId:   s.battleLoseSceneRef ? (refMap.get(s.battleLoseSceneRef) ?? null) : null,
        conditionalVariants: resolvedVariants ?? null,
      })
      .where(eq(storyScenes.id, sceneId));
  }
}

async function insertDialogueLines(
  scenes: JsonScene[],
  refMap: Map<string, number>,
): Promise<void> {
  for (const s of scenes) {
    if (!s.dialogueLines.length) continue;
    const sceneId = refMap.get(s.sceneRef)!;
    await db.insert(dialogueLines).values(
      s.dialogueLines.map((l) => ({
        sceneId,
        speakerName:  l.speakerName,
        speakerSide:  l.speakerSide,
        portraitKey:  l.portraitKey,
        text:         l.text,
        lineOrder:    l.lineOrder,
        // Sprint 4 (1a): pass grantHintKey straight through to DB.
        // Absent / null in JSON → null in DB → no shimmer rendered.
        grantHintKey: l.grantHintKey ?? null,
      })),
    );
  }
}

async function insertChoices(
  scenes: JsonScene[],
  refMap: Map<string, number>,
): Promise<void> {
  for (const s of scenes) {
    if (!s.choices.length) continue;
    const sceneId = refMap.get(s.sceneRef)!;
    await db.insert(storyChoices).values(
      s.choices.map((c) => ({
        sceneId,
        choiceText:  c.choiceText,
        nextSceneId: refMap.get(c.nextSceneRef)!,
        flagKey:     c.flagKey,
        flagValue:   c.flagValue,
        flagKey2:    c.flagKey2,
        flagValue2:  c.flagValue2,
        choiceOrder: c.choiceOrder,
      })),
    );
  }
}

async function seedOneChapter(filePath: string): Promise<void> {
  const raw  = await readFile(filePath, "utf-8");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (parseErr) {
    console.warn(`[seed-story] ⚠️  Skipping "${filePath}" — invalid JSON: ${parseErr}`);
    return;
  }

  if (!isValidChapterFile(data)) {
    console.warn(
      `[seed-story] ⚠️  Skipping "${filePath}" — does not match JsonChapterFile shape ` +
      `(expected { chapter: { title, ... }, scenes: [...] }).`,
    );
    return;
  }

  const { chapter, scenes } = data;

  const existing = await db
    .select({ id: storyChapters.id })
    .from(storyChapters)
    .where(eq(storyChapters.title, chapter.title))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed-story] ⏭️  "${chapter.title}" already in DB (id=${existing[0].id}). Skipping.`);
    return;
  }

  console.log(`[seed-story] ✨  Seeding "${chapter.title}"...`);

  const [insertedChapter] = await db
    .insert(storyChapters)
    .values({
      title:        chapter.title,
      subtitle:     chapter.subtitle,
      chapterOrder: chapter.chapterOrder,
      isLocked:     chapter.isLocked,
    })
    .returning({ id: storyChapters.id });

  const chapterId = insertedChapter.id;
  const refMap    = await buildRefMap(scenes, chapterId);
  await resolveForwardRefs(scenes, refMap);

  const firstScene = scenes.find((s) => s.sceneOrder === 1);
  if (firstScene) {
    await db
      .update(storyChapters)
      .set({ firstSceneId: refMap.get(firstScene.sceneRef) })
      .where(eq(storyChapters.id, chapterId));
  }

  await insertDialogueLines(scenes, refMap);
  await insertChoices(scenes, refMap);

  console.log(`[seed-story] ✅  "${chapter.title}" seeded (chapterId=${chapterId}).`);
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function seedStoryChapters(): Promise<void> {
  const storyDir = resolve("script/story");

  let files: string[];
  try {
    const entries = await readdir(storyDir);
    files = entries
      .filter((f) => /^chapter_.*\.json$/.test(f))
      .sort()
      .map((f) => join(storyDir, f));
  } catch {
    console.log("[seed-story] script/story/ not found. Skipping chapter seed.");
    return;
  }

  if (!files.length) {
    console.log("[seed-story] No chapter JSON files found. Skipping.");
    return;
  }

  console.log(`[seed-story] Found ${files.length} chapter file(s). Seeding...`);
  for (const filePath of files) {
    await seedOneChapter(filePath);
  }
  console.log("[seed-story] All chapters processed.");
}
