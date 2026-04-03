import { Router } from "express";
import { db } from "../db";
import { playerTitles, playerEarnedTitles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { evaluateTitles, grantTitle } from "../lib/titles";
import { storage } from "../storage";

export const titlesRouter = Router();

// GET /api/titles
// Returns all earned titles for the player, joined with catalogue data.
// Marks which one is currently active.
titlesRouter.get("/", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const user   = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const earned = await db
    .select()
    .from(playerEarnedTitles)
    .where(eq(playerEarnedTitles.userId, userId));

  const titleIds = earned.map(e => e.titleId);
  const catalogue = titleIds.length
    ? await db
        .select()
        .from(playerTitles)
        .where(
          // fetch only the titles this player owns
          // drizzle inArray helper
          require("drizzle-orm").inArray(playerTitles.id, titleIds),
        )
    : [];

  const titleMap = new Map(catalogue.map(t => [t.id, t]));

  const result = earned.map(e => ({
    earnedAt: e.earnedAt,
    isActive: (user as any).activeTitleId === e.titleId,
    ...titleMap.get(e.titleId),
  }));

  res.json(result);
});

// POST /api/titles/evaluate
// Trigger flag-based title evaluation (call this after chapter completion).
titlesRouter.post("/evaluate", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const newTitles = await evaluateTitles(userId);
  res.json({ newlyEarned: newTitles });
});

// POST /api/titles/grant
// Direct grant for story-ending rewards.
// Body: { titleKey }
titlesRouter.post("/grant", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { titleKey } = req.body;
  if (!titleKey) return res.status(400).json({ message: "titleKey required" });
  const result = await grantTitle(userId, titleKey);
  if (!result.title) return res.status(404).json({ message: "Title not found" });
  res.json(result);
});

// POST /api/titles/:key/activate
// Set the player's active display title.
titlesRouter.post("/:key/activate", async (req: any, res) => {
  const userId   = req.user.claims.sub;
  const titleKey = req.params.key;

  const [title] = await db
    .select()
    .from(playerTitles)
    .where(eq(playerTitles.titleKey, titleKey));
  if (!title) return res.status(404).json({ message: "Title not found" });

  // Verify the player owns it
  const owned = await db
    .select()
    .from(playerEarnedTitles)
    .where(
      require("drizzle-orm").and(
        eq(playerEarnedTitles.userId, userId),
        eq(playerEarnedTitles.titleId, title.id),
      ),
    );
  if (!owned.length) return res.status(403).json({ message: "You have not earned this title" });

  await storage.updateUser(userId, { activeTitleId: title.id } as any);
  res.json({ success: true, activeTitleId: title.id, displayName: title.displayName });
});

// POST /api/titles/deactivate
// Clear the active title.
titlesRouter.post("/deactivate", async (req: any, res) => {
  const userId = req.user.claims.sub;
  await storage.updateUser(userId, { activeTitleId: null } as any);
  res.json({ success: true });
});
