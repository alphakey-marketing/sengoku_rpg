/**
 * story-routes.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * All REST endpoints for the VN story engine.
 *
 * Mount in server/routes.ts with:
 *   app.use("/api/story", isAuthenticated, storyRouter);
 *
 * Endpoints
 * ──────────────────────────────────────────────────────────────────────────────
 *  GET  /api/story/chapters             → list all chapters with per-user isUnlocked / isCompleted
 *  GET  /api/story/chapters/:id         → full chapter with scenes + dialogue + choices
 *  GET  /api/story/progress             → player's progress for all chapters
 *  POST /api/story/progress             → upsert progress (start / advance scene)
 *  POST /api/story/progress/complete    → mark chapter complete + write ending + bump currentChapter
 *  GET  /api/story/flags                → all player flags as Record<string,number>
 *  POST /api/story/flags                → additive mutations OR absolute overrides
 *  GET  /api/story/endings              → all unlocked endings
 *  POST /api/story/battle-result        → write battle outcome flags + return nextSceneId
 */

import { Router, type Request, type Response } from "express";
import { db } from "./db";
import {
  storyChapters, storyScenes, dialogueLines, storyChoices,
  playerFlags, playerStoryProgress, storyEndings,
  users,
  type DialogueLine,
  type StoryChoice,
  type PlayerFlag,
} from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { storage } from "./storage";

export const storyRouter = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): string | null {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorised" });
    return null;
  }
  return userId as string;
}

// ─── Shared flag helpers ──────────────────────────────────────────────────────

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
 * Write flag mutations to DB in a single batch upsert.
 *
 * @param mutations  Additive deltas  { key: delta }  (default behaviour)
 * @param absolute   Absolute sets    { key: value }  (battle outcomes)
 *
 * Uses INSERT … ON CONFLICT (userId, flagKey) DO UPDATE so all keys land
 * in one round trip instead of N individual UPDATE/INSERT pairs.
 * The in-memory flagMap is updated after the upsert and returned directly
 * (no redundant re-read from DB).
 */
async function writeFlags(
  userId: string,
  mutations: Record<string, number> = {},
  absolute: Record<string, number> = {},
): Promise<Record<string, number>> {
  const allKeys = [...Object.keys(mutations), ...Object.keys(absolute)];
  if (allKeys.length === 0) {
    // Nothing to write — just return current flags.
    return flagRecord(await getFlagMap(userId));
  }

  // Read current values once.
  const flagMap = await getFlagMap(userId);

  // Build the merged set of (key → newValue) to upsert.
  const toUpsert: { flagKey: string; flagValue: number }[] = [];

  for (const [key, delta] of Object.entries(mutations)) {
    const current = flagMap.get(key)?.flagValue ?? 0;
    const newValue = current + delta;
    toUpsert.push({ flagKey: key, flagValue: newValue });
    // Update in-memory map so flagRecord() at the end is accurate.
    const existing = flagMap.get(key);
    if (existing) {
      existing.flagValue = newValue;
    } else {
      flagMap.set(key, { id: -1, userId, flagKey: key, flagValue: newValue, updatedAt: new Date() });
    }
  }

  for (const [key, value] of Object.entries(absolute)) {
    toUpsert.push({ flagKey: key, flagValue: value });
    const existing = flagMap.get(key);
    if (existing) {
      existing.flagValue = value;
    } else {
      flagMap.set(key, { id: -1, userId, flagKey: key, flagValue: value, updatedAt: new Date() });
    }
  }

  // Single batch upsert — one DB round trip for all keys.
  await db
    .insert(playerFlags)
    .values(toUpsert.map((r) => ({ userId, flagKey: r.flagKey, flagValue: r.flagValue })))
    .onConflictDoUpdate({
      target: [playerFlags.userId, playerFlags.flagKey],
      set: {
        flagValue: sql`excluded.flag_value`,
        updatedAt: sql`now()`,
      },
    });

  return flagRecord(flagMap);
}

// ─── Chapter list ─────────────────────────────────────────────────────────────

storyRouter.get("/chapters", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const chapters = await db
      .select()
      .from(storyChapters)
      .orderBy(asc(storyChapters.chapterOrder));

    const [userRow] = await db
      .select({ currentChapter: users.currentChapter })
      .from(users)
      .where(eq(users.id, userId));

    const progressRows = await db
      .select()
      .from(playerStoryProgress)
      .where(eq(playerStoryProgress.userId, userId));

    const progressByChapter = new Map(
      progressRows.map((p) => [p.chapterId, p])
    );

    const currentChapter = userRow?.currentChapter ?? 0;

    const enriched = chapters.map((ch) => {
      if (ch.isLocked) {
        return { ...ch, isUnlocked: false, isCompleted: false, currentSceneId: null };
      }
      const isUnlocked    = ch.chapterOrder <= currentChapter + 1;
      const progress      = progressByChapter.get(ch.id);
      const isCompleted    = progress?.isCompleted ?? false;
      const currentSceneId = progress?.currentSceneId ?? null;
      return { ...ch, isUnlocked, isCompleted, currentSceneId };
    });

    res.json(enriched);
  } catch (e) {
    console.error("[story] GET /chapters", e);
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
    if (!chapter) return res.status(404).json({ error: `Chapter ${chapterId} not yet available` });

    const scenes = await db
      .select()
      .from(storyScenes)
      .where(eq(storyScenes.chapterId, chapterId))
      .orderBy(asc(storyScenes.sceneOrder));

    if (!scenes.length) {
      return res.status(404).json({ error: `Chapter ${chapterId} not yet available` });
    }

    const sceneIds = scenes.map((s) => s.id);

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

    const linesByScene   = new Map<number, DialogueLine[]>();
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

// ─── Player progress ──────────────────────────────────────────────────────────

storyRouter.get("/progress", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(
      await db.select().from(playerStoryProgress).where(eq(playerStoryProgress.userId, userId))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

storyRouter.post("/progress", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { chapterId: rawChapterId, currentSceneId, forceRestart } = req.body as {
      chapterId: unknown;
      currentSceneId?: number;
      forceRestart?: boolean;
    };
    const chapterId = Number(rawChapterId);
    if (!chapterId || isNaN(chapterId)) return res.status(400).json({ error: "chapterId required" });

    const [existing] = await db
      .select()
      .from(playerStoryProgress)
      .where(and(eq(playerStoryProgress.userId, userId), eq(playerStoryProgress.chapterId, chapterId)));

    if (forceRestart && existing) {
      await db
        .delete(playerStoryProgress)
        .where(and(eq(playerStoryProgress.userId, userId), eq(playerStoryProgress.chapterId, chapterId)));
      const [fresh] = await db
        .insert(playerStoryProgress)
        .values({ userId, chapterId, currentSceneId: currentSceneId ?? null, isCompleted: false })
        .returning();
      return res.json(fresh);
    }

    if (!existing) {
      const [created] = await db
        .insert(playerStoryProgress)
        .values({ userId, chapterId, currentSceneId: currentSceneId ?? null, isCompleted: false })
        .returning();
      return res.json(created);
    }

    const [updated] = await db
      .update(playerStoryProgress)
      .set({ currentSceneId: currentSceneId ?? existing.currentSceneId })
      .where(and(eq(playerStoryProgress.userId, userId), eq(playerStoryProgress.chapterId, chapterId)))
      .returning();
    res.json(updated);
  } catch (e) {
    console.error("[story] POST /progress", e);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

storyRouter.post("/progress/complete", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { chapterId: rawChapterId, endingKey, endingTitle, endingDescription } = req.body as {
      chapterId: unknown;
      endingKey: string;
      endingTitle: string;
      endingDescription: string;
    };
    const chapterId = Number(rawChapterId);
    if (!chapterId || isNaN(chapterId)) {
      return res.status(400).json({ error: "chapterId must be a valid integer" });
    }

    await db
      .update(playerStoryProgress)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(and(eq(playerStoryProgress.userId, userId), eq(playerStoryProgress.chapterId, chapterId)));

    const [existing] = await db
      .select()
      .from(storyEndings)
      .where(and(eq(storyEndings.userId, userId), eq(storyEndings.endingKey, endingKey)));

    if (!existing) {
      await db.insert(storyEndings).values({
        userId,
        chapterId,
        endingKey,
        endingTitle,
        endingDescription,
      });
    }

    const player = await storage.getUser(userId);
    if (player) {
      const newChapter = Math.max(player.currentChapter ?? 0, chapterId);
      if (newChapter > (player.currentChapter ?? 0)) {
        await storage.updateUser(userId, { currentChapter: newChapter });
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("[story] POST /progress/complete", e);
    res.status(500).json({ error: "Failed to complete chapter" });
  }
});

// ─── Player flags ─────────────────────────────────────────────────────────────

storyRouter.get("/flags", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(flagRecord(await getFlagMap(userId)));
  } catch {
    res.status(500).json({ error: "Failed to fetch flags" });
  }
});

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

// ─── Unlocked endings ─────────────────────────────────────────────────────────

storyRouter.get("/endings", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(
      await db.select().from(storyEndings).where(eq(storyEndings.userId, userId))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch endings" });
  }
});

// ─── Battle-result ────────────────────────────────────────────────────────────
//
// Single endpoint that resolves win/lose scene routing AND writes battle
// outcome flags in one server call. The client previously duplicated both
// of these jobs inline; now it just calls this endpoint and uses the
// returned nextSceneId to advance.

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
