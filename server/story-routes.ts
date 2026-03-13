/**
 * story-routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All REST endpoints for the VN story engine.
 *
 * Mounted in routes.ts with:
 *   app.use("/api/story", isAuthenticated, storyRouter);
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET  /api/story/chapters             → list all chapters (id, title, isLocked)
 *  GET  /api/story/chapters/:id         → full chapter with scenes + dialogue + choices
 *  GET  /api/story/progress             → player's progress for all chapters
 *  POST /api/story/progress             → upsert progress (start / advance scene)
 *  POST /api/story/progress/complete    → mark chapter complete, unlock next chapter, write ending
 *  GET  /api/story/flags                → all player flags
 *  POST /api/story/flags                → apply flag mutations (additive)
 *  GET  /api/story/endings              → all unlocked endings
 */

import { Router, type Request, type Response } from "express";
import { db } from "./db";
import {
  storyChapters, storyScenes, dialogueLines, storyChoices,
  playerFlags, playerProgress, unlockedEndings,
  type StoryChapter, type StoryScene, type DialogueLine,
  type StoryChoice, type PlayerFlag, type PlayerProgress,
} from "@shared/schema";
import { eq, and, asc, gt } from "drizzle-orm";

export const storyRouter = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Note: isAuthenticated middleware is applied at mount-point in routes.ts,
// so every handler here is already authenticated. This helper just extracts
// the userId from the already-verified request.
function getUserId(req: Request): string {
  return (req as any).user.claims.sub as string;
}

// ─── Chapter list ─────────────────────────────────────────────────────────────

storyRouter.get("/chapters", async (req: Request, res: Response) => {
  try {
    const chapters = await db
      .select()
      .from(storyChapters)
      .orderBy(asc(storyChapters.chapterOrder));
    res.json(chapters);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch chapters" });
  }
});

// ─── Full chapter (scenes + dialogue + choices) ───────────────────────────────

storyRouter.get("/chapters/:id", async (req: Request, res: Response) => {
  try {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) return res.status(400).json({ error: "Invalid chapter id" });

    const [chapter] = await db
      .select()
      .from(storyChapters)
      .where(eq(storyChapters.id, chapterId));

    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    const scenes = await db
      .select()
      .from(storyScenes)
      .where(eq(storyScenes.chapterId, chapterId))
      .orderBy(asc(storyScenes.sceneOrder));

    const sceneIds = scenes.map((s) => s.id);

    const allLines: DialogueLine[] = sceneIds.length
      ? await db
          .select()
          .from(dialogueLines)
          .where(eq(dialogueLines.sceneId, sceneIds[0]))
          .then(async () => {
            const results = await Promise.all(
              sceneIds.map((sid) =>
                db.select().from(dialogueLines).where(eq(dialogueLines.sceneId, sid))
                  .orderBy(asc(dialogueLines.lineOrder))
              )
            );
            return results.flat();
          })
      : [];

    const allChoices: StoryChoice[] = sceneIds.length
      ? await Promise.all(
          sceneIds.map((sid) =>
            db.select().from(storyChoices).where(eq(storyChoices.sceneId, sid))
              .orderBy(asc(storyChoices.choiceOrder))
          )
        ).then((r) => r.flat())
      : [];

    const linesByScene = new Map<number, DialogueLine[]>();
    const choicesByScene = new Map<number, StoryChoice[]>();
    for (const line of allLines) linesByScene.set(line.sceneId, [...(linesByScene.get(line.sceneId) ?? []), line]);
    for (const c of allChoices) choicesByScene.set(c.sceneId, [...(choicesByScene.get(c.sceneId) ?? []), c]);

    const enrichedScenes = scenes.map((scene) => ({
      ...scene,
      dialogueLines: linesByScene.get(scene.id) ?? [],
      choices: choicesByScene.get(scene.id) ?? [],
    }));

    res.json({ ...chapter, scenes: enrichedScenes });
  } catch (e) {
    console.error("[story] GET /chapters/:id", e);
    res.status(500).json({ error: "Failed to fetch chapter" });
  }
});

// ─── Player progress ──────────────────────────────────────────────────────────

storyRouter.get("/progress", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(playerProgress)
      .where(eq(playerProgress.userId, userId));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

/**
 * POST /api/story/progress
 * Body: { chapterId: number; currentSceneId?: number; forceRestart?: boolean }
 */
storyRouter.post("/progress", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const { chapterId, currentSceneId, forceRestart } = req.body as {
      chapterId: number;
      currentSceneId?: number;
      forceRestart?: boolean;
    };

    if (!chapterId) return res.status(400).json({ error: "chapterId required" });

    const [existing] = await db
      .select()
      .from(playerProgress)
      .where(and(eq(playerProgress.userId, userId), eq(playerProgress.chapterId, chapterId)));

    if (forceRestart && existing) {
      await db
        .delete(playerProgress)
        .where(and(eq(playerProgress.userId, userId), eq(playerProgress.chapterId, chapterId)));

      const [fresh] = await db
        .insert(playerProgress)
        .values({ userId, chapterId, currentSceneId: currentSceneId ?? null, isCompleted: false, seenSceneIds: [] })
        .returning();
      return res.json(fresh);
    }

    if (!existing) {
      const [created] = await db
        .insert(playerProgress)
        .values({ userId, chapterId, currentSceneId: currentSceneId ?? null, isCompleted: false, seenSceneIds: [] })
        .returning();
      return res.json(created);
    }

    const seenIds = (existing.seenSceneIds as number[]) ?? [];
    if (currentSceneId && !seenIds.includes(currentSceneId)) seenIds.push(currentSceneId);

    const [updated] = await db
      .update(playerProgress)
      .set({ currentSceneId: currentSceneId ?? existing.currentSceneId, seenSceneIds: seenIds })
      .where(and(eq(playerProgress.userId, userId), eq(playerProgress.chapterId, chapterId)))
      .returning();

    res.json(updated);
  } catch (e) {
    console.error("[story] POST /progress", e);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

/**
 * POST /api/story/progress/complete
 * Body: { chapterId, endingKey, endingTitle, endingDescription }
 *
 * Item 3: after marking the chapter complete, find the next chapter by
 * chapterOrder and set isLocked = false on it so it becomes playable.
 * Response includes { nextChapterUnlocked, nextChapterId } so the client
 * can show a "Next chapter unlocked!" message.
 */
storyRouter.post("/progress/complete", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const { chapterId, endingKey, endingTitle, endingDescription } = req.body as {
      chapterId: number;
      endingKey: string;
      endingTitle: string;
      endingDescription: string;
    };

    // 1. Mark this chapter complete
    await db
      .update(playerProgress)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(and(eq(playerProgress.userId, userId), eq(playerProgress.chapterId, chapterId)));

    // 2. Upsert the ending record (idempotent)
    const [existingEnding] = await db
      .select()
      .from(unlockedEndings)
      .where(and(eq(unlockedEndings.userId, userId), eq(unlockedEndings.endingKey, endingKey)));

    if (!existingEnding) {
      await db.insert(unlockedEndings).values({ userId, endingKey, endingTitle, endingDescription });
    }

    // 3. Auto-unlock the next chapter (Item 3)
    //    Find the completed chapter's order, then unlock the immediately following one.
    const [completedChapter] = await db
      .select({ chapterOrder: storyChapters.chapterOrder })
      .from(storyChapters)
      .where(eq(storyChapters.id, chapterId));

    let nextChapterId: number | null = null;
    let nextChapterUnlocked = false;

    if (completedChapter) {
      const [nextChapter] = await db
        .select({ id: storyChapters.id, isLocked: storyChapters.isLocked })
        .from(storyChapters)
        .where(
          and(
            gt(storyChapters.chapterOrder, completedChapter.chapterOrder),
            eq(storyChapters.isLocked, true),
          )
        )
        .orderBy(asc(storyChapters.chapterOrder))
        .limit(1);

      if (nextChapter) {
        await db
          .update(storyChapters)
          .set({ isLocked: false })
          .where(eq(storyChapters.id, nextChapter.id));
        nextChapterId      = nextChapter.id;
        nextChapterUnlocked = true;
      }
    }

    res.json({ success: true, nextChapterUnlocked, nextChapterId });
  } catch (e) {
    console.error("[story] POST /progress/complete", e);
    res.status(500).json({ error: "Failed to complete chapter" });
  }
});

// ─── Player flags ─────────────────────────────────────────────────────────────

storyRouter.get("/flags", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const flags = await db
      .select()
      .from(playerFlags)
      .where(eq(playerFlags.userId, userId));
    const record: Record<string, number> = {};
    for (const f of flags) record[f.flagKey] = f.flagValue;
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch flags" });
  }
});

/**
 * POST /api/story/flags
 * Body: { mutations: Record<string, number> }  — values are additive deltas
 */
storyRouter.post("/flags", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const { mutations } = req.body as { mutations: Record<string, number> };
    if (!mutations || typeof mutations !== "object") {
      return res.status(400).json({ error: "mutations object required" });
    }

    const existingFlags = await db
      .select()
      .from(playerFlags)
      .where(eq(playerFlags.userId, userId));

    const flagMap = new Map<string, PlayerFlag>();
    for (const f of existingFlags) flagMap.set(f.flagKey, f);

    for (const [key, delta] of Object.entries(mutations)) {
      const existing = flagMap.get(key);
      if (existing) {
        await db
          .update(playerFlags)
          .set({ flagValue: existing.flagValue + delta, updatedAt: new Date() })
          .where(eq(playerFlags.id, existing.id));
      } else {
        await db.insert(playerFlags).values({ userId, flagKey: key, flagValue: delta });
      }
    }

    const updated = await db.select().from(playerFlags).where(eq(playerFlags.userId, userId));
    const record: Record<string, number> = {};
    for (const f of updated) record[f.flagKey] = f.flagValue;
    res.json(record);
  } catch (e) {
    console.error("[story] POST /flags", e);
    res.status(500).json({ error: "Failed to update flags" });
  }
});

// ─── Unlocked endings ─────────────────────────────────────────────────────────

storyRouter.get("/endings", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  try {
    const endings = await db
      .select()
      .from(unlockedEndings)
      .where(eq(unlockedEndings.userId, userId));
    res.json(endings);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch endings" });
  }
});
