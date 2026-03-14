/**
 * story-routes.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * All REST endpoints for the VN story engine.
 *
 * Mount in server/index.ts (or routes.ts) with:
 *   app.use("/api/story", isAuthenticated, storyRouter);
 *
 * Endpoints
 * ──────────────────────────────────────────────────────────────────────────────
 *  GET  /api/story/chapters             → list all chapters (id, title, isLocked, chapterOrder)
 *  GET  /api/story/chapters/:id         → full chapter with scenes + dialogue + choices
 *  GET  /api/story/progress             → player’s progress for all chapters
 *  POST /api/story/progress             → upsert progress (start / advance scene)
 *  POST /api/story/progress/complete    → mark chapter complete + write ending
 *  GET  /api/story/flags                → all player flags as Record<string,number>
 *  POST /api/story/flags                → additive mutations OR absolute overrides
 *  GET  /api/story/endings              → all unlocked endings
 *  POST /api/story/battle-result        → B2: write battle outcome flags + return nextSceneId
 */

import { Router, type Request, type Response } from "express";
import { db } from "./db";
import {
  storyChapters, storyScenes, dialogueLines, storyChoices,
  playerFlags, playerProgress, unlockedEndings,
  type StoryChapter, type StoryScene, type DialogueLine,
  type StoryChoice, type PlayerFlag,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

export const storyRouter = Router();

// ─── Auth helper ────────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): string | null {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorised" });
    return null;
  }
  return userId as string;
}

// ─── Shared flag helpers ───────────────────────────────────────────────────────────

/** Read all flags for a user, returning a map keyed by flagKey. */
async function getFlagMap(userId: string): Promise<Map<string, PlayerFlag>> {
  const rows = await db.select().from(playerFlags).where(eq(playerFlags.userId, userId));
  return new Map(rows.map((f) => [f.flagKey, f]));
}

/** Serialise a flag map to a plain Record. */
function flagRecord(map: Map<string, PlayerFlag>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of map) out[k] = v.flagValue;
  return out;
}

/**
 * Write flag mutations to DB.
 * @param mutations  Additive deltas  { key: delta }  (default behaviour)
 * @param absolute   Absolute sets    { key: value }  (B2: battle outcomes)
 * Returns updated flag record.
 */
async function writeFlags(
  userId: string,
  mutations: Record<string, number> = {},
  absolute: Record<string, number> = {},
): Promise<Record<string, number>> {
  const flagMap = await getFlagMap(userId);

  // Additive mutations
  for (const [key, delta] of Object.entries(mutations)) {
    const existing = flagMap.get(key);
    if (existing) {
      await db
        .update(playerFlags)
        .set({ flagValue: existing.flagValue + delta, updatedAt: new Date() })
        .where(eq(playerFlags.id, existing.id));
      existing.flagValue += delta;
    } else {
      const [inserted] = await db
        .insert(playerFlags)
        .values({ userId, flagKey: key, flagValue: delta })
        .returning();
      flagMap.set(key, inserted);
    }
  }

  // Absolute overrides (SET, not +delta)
  for (const [key, value] of Object.entries(absolute)) {
    const existing = flagMap.get(key);
    if (existing) {
      await db
        .update(playerFlags)
        .set({ flagValue: value, updatedAt: new Date() })
        .where(eq(playerFlags.id, existing.id));
      existing.flagValue = value;
    } else {
      const [inserted] = await db
        .insert(playerFlags)
        .values({ userId, flagKey: key, flagValue: value })
        .returning();
      flagMap.set(key, inserted);
    }
  }

  return flagRecord(await getFlagMap(userId));
}

// ─── Chapter list ────────────────────────────────────────────────────────────────────

storyRouter.get("/chapters", async (_req: Request, res: Response) => {
  try {
    const chapters = await db
      .select()
      .from(storyChapters)
      .orderBy(asc(storyChapters.chapterOrder));
    res.json(chapters);
  } catch {
    res.status(500).json({ error: "Failed to fetch chapters" });
  }
});

// ─── Full chapter (scenes + dialogue + choices) ─────────────────────────────────────────

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
    if (!sceneIds.length) return res.json({ ...chapter, scenes: [] });

    // Fetch all dialogue and choices for every scene in parallel (one query per scene)
    // This replaces the old double-query bug where the first .then() fetched only
    // sceneIds[0] then discarded its result before the real Promise.all ran.
    const [allLines, allChoices] = await Promise.all([
      Promise.all(
        sceneIds.map((sid) =>
          db.select().from(dialogueLines)
            .where(eq(dialogueLines.sceneId, sid))
            .orderBy(asc(dialogueLines.lineOrder))
        )
      ).then((r) => r.flat()),
      Promise.all(
        sceneIds.map((sid) =>
          db.select().from(storyChoices)
            .where(eq(storyChoices.sceneId, sid))
            .orderBy(asc(storyChoices.choiceOrder))
        )
      ).then((r) => r.flat()),
    ]);

    // Group by sceneId
    const linesByScene  = new Map<number, DialogueLine[]>();
    const choicesByScene = new Map<number, StoryChoice[]>();
    for (const l of allLines)   linesByScene.set(l.sceneId,   [...(linesByScene.get(l.sceneId)   ?? []), l]);
    for (const c of allChoices) choicesByScene.set(c.sceneId, [...(choicesByScene.get(c.sceneId) ?? []), c]);

    res.json({
      ...chapter,
      scenes: scenes.map((scene) => ({
        ...scene,
        dialogueLines: linesByScene.get(scene.id)  ?? [],
        choices:       choicesByScene.get(scene.id) ?? [],
      })),
    });
  } catch (e) {
    console.error("[story] GET /chapters/:id", e);
    res.status(500).json({ error: "Failed to fetch chapter" });
  }
});

// ─── Player progress ───────────────────────────────────────────────────────────────────

storyRouter.get("/progress", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(
      await db.select().from(playerProgress).where(eq(playerProgress.userId, userId))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

/**
 * POST /api/story/progress
 * Body: { chapterId: number; currentSceneId?: number; forceRestart?: boolean }
 *
 * Creates a fresh progress row if none exists.
 * forceRestart=true: deletes existing row and creates fresh.
 * Otherwise: upserts currentSceneId and adds it to seenSceneIds.
 */
storyRouter.post("/progress", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
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

    const seen = (existing.seenSceneIds as number[]) ?? [];
    if (currentSceneId && !seen.includes(currentSceneId)) seen.push(currentSceneId);
    const [updated] = await db
      .update(playerProgress)
      .set({ currentSceneId: currentSceneId ?? existing.currentSceneId, seenSceneIds: seen })
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
 */
storyRouter.post("/progress/complete", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { chapterId, endingKey, endingTitle, endingDescription } = req.body as {
      chapterId: number;
      endingKey: string;
      endingTitle: string;
      endingDescription: string;
    };

    await db
      .update(playerProgress)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(and(eq(playerProgress.userId, userId), eq(playerProgress.chapterId, chapterId)));

    const [existing] = await db
      .select()
      .from(unlockedEndings)
      .where(and(eq(unlockedEndings.userId, userId), eq(unlockedEndings.endingKey, endingKey)));

    if (!existing) {
      await db.insert(unlockedEndings).values({ userId, endingKey, endingTitle, endingDescription });
    }

    res.json({ success: true });
  } catch (e) {
    console.error("[story] POST /progress/complete", e);
    res.status(500).json({ error: "Failed to complete chapter" });
  }
});

// ─── Player flags ────────────────────────────────────────────────────────────────────

storyRouter.get("/flags", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(flagRecord(await getFlagMap(userId)));
  } catch {
    res.status(500).json({ error: "Failed to fetch flags" });
  }
});

/**
 * POST /api/story/flags
 * Body: { mutations?: Record<string,number>, absolute?: Record<string,number> }
 *
 * mutations  — additive delta per flag key (legacy behaviour, still supported)
 * absolute   — exact SET value per flag key (B2: battle_won / battle_lost)
 *
 * Both can be present in the same request.
 */
storyRouter.post("/flags", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { mutations = {}, absolute = {} } = req.body as {
      mutations?: Record<string, number>;
      absolute?:  Record<string, number>;
    };
    if (typeof mutations !== "object" || typeof absolute !== "object") {
      return res.status(400).json({ error: "mutations and absolute must be objects" });
    }
    res.json(await writeFlags(userId, mutations, absolute));
  } catch (e) {
    console.error("[story] POST /flags", e);
    res.status(500).json({ error: "Failed to update flags" });
  }
});

// ─── Unlocked endings ─────────────────────────────────────────────────────────────────

storyRouter.get("/endings", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(
      await db.select().from(unlockedEndings).where(eq(unlockedEndings.userId, userId))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch endings" });
  }
});

// ─── B2: Battle-result endpoint ─────────────────────────────────────────────────────────
//
// POST /api/story/battle-result
// Body: { sceneId: number; battleResult: 'win' | 'lose' }
//
// 1. Looks up the scene to find battleWinSceneId / battleLoseSceneId.
// 2. Writes absolute flags: battle_won=1/0, battle_lost=1/0.
// 3. Returns { nextSceneId, flagsUpdated } matching the submitChoice shape.
//
// This endpoint is the authoritative server-side counterpart to the client’s
// BattleGateOverlay. The client still calls /api/battle/field for the actual
// combat; this endpoint only handles the story-graph routing + flag writing.

storyRouter.post("/battle-result", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { sceneId, battleResult } = req.body as {
      sceneId: number;
      battleResult: "win" | "lose";
    };
    if (!sceneId || !battleResult) {
      return res.status(400).json({ error: "sceneId and battleResult required" });
    }

    const [scene] = await db
      .select()
      .from(storyScenes)
      .where(eq(storyScenes.id, sceneId));
    if (!scene) return res.status(404).json({ error: "Scene not found" });

    const won = battleResult === "win";
    const nextSceneId = won
      ? (scene.battleWinSceneId ?? scene.nextSceneId)
      : (scene.battleLoseSceneId ?? scene.nextSceneId);

    const flagsUpdated = await writeFlags(userId, {}, {
      battle_won:  won ? 1 : 0,
      battle_lost: won ? 0 : 1,
    });

    res.json({ nextSceneId, flagsUpdated });
  } catch (e) {
    console.error("[story] POST /battle-result", e);
    res.status(500).json({ error: "Failed to process battle result" });
  }
});
