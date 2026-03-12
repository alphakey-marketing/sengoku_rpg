/**
 * Phase 2 Story Seed Script
 * Usage: npm run seed:story
 *
 * Reads JSON files from script/story/ and inserts them into PostgreSQL.
 * IDEMPOTENT: checks for existing chapter by title before inserting.
 * Safe to re-run without duplicating data.
 */

import { readFile, readdir } from "fs/promises";
import { resolve, join } from "path";
import { db } from "../server/db.js";
import {
  storyChapters,
  storyScenes,
  dialogueLines,
  storyChoices,
} from "../shared/schema.js";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types matching chapter_XX.json structure
// ---------------------------------------------------------------------------

interface JsonDialogueLine {
  speakerName: string;
  speakerSide: string;
  portraitKey: string | null;
  text: string;
  lineOrder: number;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a lookup map: sceneRef string -> inserted DB scene id */
async function buildRefMap(
  scenes: JsonScene[],
  chapterId: number
): Promise<Map<string, number>> {
  const refMap = new Map<string, number>();

  for (const s of scenes) {
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
        // nextSceneId, battleWinSceneId, battleLoseSceneId resolved in second pass
      })
      .returning({ id: storyScenes.id });

    refMap.set(s.sceneRef, inserted.id);
  }

  return refMap;
}

/** Second pass: wire up forward-reference scene IDs now that all scenes exist */
async function resolveForwardRefs(
  scenes: JsonScene[],
  refMap: Map<string, number>
): Promise<void> {
  for (const s of scenes) {
    const sceneId = refMap.get(s.sceneRef)!;

    await db
      .update(storyScenes)
      .set({
        nextSceneId: s.nextSceneRef ? (refMap.get(s.nextSceneRef) ?? null) : null,
        battleWinSceneId: s.battleWinSceneRef
          ? (refMap.get(s.battleWinSceneRef) ?? null)
          : null,
        battleLoseSceneId: s.battleLoseSceneRef
          ? (refMap.get(s.battleLoseSceneRef) ?? null)
          : null,
      })
      .where(eq(storyScenes.id, sceneId));
  }
}

/** Insert dialogue lines for all scenes */
async function insertDialogueLines(
  scenes: JsonScene[],
  refMap: Map<string, number>
): Promise<void> {
  for (const s of scenes) {
    if (s.dialogueLines.length === 0) continue;
    const sceneId = refMap.get(s.sceneRef)!;

    await db.insert(dialogueLines).values(
      s.dialogueLines.map((line) => ({
        sceneId,
        speakerName: line.speakerName,
        speakerSide: line.speakerSide,
        portraitKey: line.portraitKey,
        text: line.text,
        lineOrder: line.lineOrder,
      }))
    );
  }
}

/** Insert choices for all scenes (requires refMap for nextSceneId resolution) */
async function insertChoices(
  scenes: JsonScene[],
  refMap: Map<string, number>
): Promise<void> {
  for (const s of scenes) {
    if (s.choices.length === 0) continue;
    const sceneId = refMap.get(s.sceneRef)!;

    await db.insert(storyChoices).values(
      s.choices.map((c) => ({
        sceneId,
        choiceText: c.choiceText,
        nextSceneId: refMap.get(c.nextSceneRef)!,
        flagKey: c.flagKey,
        flagValue: c.flagValue,
        flagKey2: c.flagKey2,
        flagValue2: c.flagValue2,
        choiceOrder: c.choiceOrder,
      }))
    );
  }
}

// ---------------------------------------------------------------------------
// Main seed function for one chapter file
// ---------------------------------------------------------------------------

async function seedChapterFile(filePath: string): Promise<void> {
  const raw = await readFile(filePath, "utf-8");
  const data: JsonChapterFile = JSON.parse(raw);

  const { chapter, scenes } = data;

  // --- Idempotency check: skip if chapter already seeded ---
  const existing = await db
    .select({ id: storyChapters.id })
    .from(storyChapters)
    .where(eq(storyChapters.title, chapter.title))
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `  \u23ED\uFE0F  Chapter "${chapter.title}" already exists (id=${existing[0].id}). Skipping.`
    );
    return;
  }

  console.log(`  \u2728  Seeding chapter: "${chapter.title}"...`);

  // 1. Insert chapter
  const [insertedChapter] = await db
    .insert(storyChapters)
    .values({
      title: chapter.title,
      subtitle: chapter.subtitle,
      chapterOrder: chapter.chapterOrder,
      isLocked: chapter.isLocked,
    })
    .returning({ id: storyChapters.id });

  const chapterId = insertedChapter.id;

  // 2. First pass: insert all scenes (without forward refs)
  console.log(`     Inserting ${scenes.length} scenes...`);
  const refMap = await buildRefMap(scenes, chapterId);

  // 3. Second pass: resolve forward refs (nextSceneId, battleWinSceneId, etc.)
  console.log(`     Resolving scene forward references...`);
  await resolveForwardRefs(scenes, refMap);

  // 4. Set chapter.firstSceneId to the scene with sceneOrder=1
  const firstScene = scenes.find((s) => s.sceneOrder === 1);
  if (firstScene) {
    await db
      .update(storyChapters)
      .set({ firstSceneId: refMap.get(firstScene.sceneRef) })
      .where(eq(storyChapters.id, chapterId));
  }

  // 5. Insert dialogue lines
  const totalLines = scenes.reduce((n, s) => n + s.dialogueLines.length, 0);
  console.log(`     Inserting ${totalLines} dialogue lines...`);
  await insertDialogueLines(scenes, refMap);

  // 6. Insert choices
  const totalChoices = scenes.reduce((n, s) => n + s.choices.length, 0);
  console.log(`     Inserting ${totalChoices} choices...`);
  await insertChoices(scenes, refMap);

  console.log(
    `  \u2705  Chapter "${chapter.title}" seeded successfully (chapterId=${chapterId}).`
  );
}

// ---------------------------------------------------------------------------
// Entry point: scan script/story/ for all chapter JSON files
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const storyDir = resolve("script/story");
  const files = (await readdir(storyDir))
    .filter((f) => f.endsWith(".json"))
    .sort() // ensures chapter_01 < chapter_02 etc.
    .map((f) => join(storyDir, f));

  if (files.length === 0) {
    console.log("No story JSON files found in script/story/. Nothing to seed.");
    return;
  }

  console.log(`\nSengoku Chronicles \u2014 Story Seed Script`);
  console.log(`Found ${files.length} chapter file(s):\n`);

  for (const filePath of files) {
    await seedChapterFile(filePath);
  }

  console.log("\nAll chapters seeded. Done.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
