/**
 * server/seed-story-chapters.ts
 *
 * Auto-seeds story chapters from script/story/chapter_XX.json into the DB
 * on every server startup. Idempotent — skips any chapter already present.
 *
 * Called from server/index.ts between runMigrations() and route registration.
 */

import { readFile, readdir } from "fs/promises";
import { resolve, join } from "path";
import { db } from "./db";
import {
  storyChapters,
  storyScenes,
  dialogueLines,
  storyChoices,
} from "../shared/schema";
import { eq } from "drizzle-orm";

// ─── JSON file types ──────────────────────────────────────────────────────────────

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

// ─── Core seed logic (mirrors script/seed-story.ts) ────────────────────────────

async function buildRefMap(
  scenes: JsonScene[],
  chapterId: number,
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
    await db
      .update(storyScenes)
      .set({
        nextSceneId:       s.nextSceneRef       ? (refMap.get(s.nextSceneRef)       ?? null) : null,
        battleWinSceneId:  s.battleWinSceneRef  ? (refMap.get(s.battleWinSceneRef)  ?? null) : null,
        battleLoseSceneId: s.battleLoseSceneRef ? (refMap.get(s.battleLoseSceneRef) ?? null) : null,
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
        speakerName: l.speakerName,
        speakerSide: l.speakerSide,
        portraitKey: l.portraitKey,
        text: l.text,
        lineOrder: l.lineOrder,
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
  const data: JsonChapterFile = JSON.parse(raw);
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

// ─── Public entry point ──────────────────────────────────────────────────────────────

export async function seedStoryChapters(): Promise<void> {
  // Resolve relative to the project root (where server/ lives), not __dirname,
  // so this works whether running via ts-node, tsx, or compiled JS.
  const storyDir = resolve("script/story");

  let files: string[];
  try {
    const entries = await readdir(storyDir);
    files = entries
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => join(storyDir, f));
  } catch {
    // script/story doesn't exist in this environment — safe to skip.
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
