import { Router } from "express";
import { db } from "../db";
import { chronicleEntries } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { appendChronicle } from "../lib/chronicle";

export const chronicleRouter = Router();

// GET /api/chronicle
chronicleRouter.get("/", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const entries = await db
    .select()
    .from(chronicleEntries)
    .where(eq(chronicleEntries.userId, userId))
    .orderBy(desc(chronicleEntries.recordedAt));
  res.json(entries);
});

// POST /api/chronicle
// Body: { entryKey, headline, detail?, chapterNumber? }
chronicleRouter.post("/", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { entryKey, headline, detail, chapterNumber } = req.body;
  if (!entryKey || !headline)
    return res.status(400).json({ message: "entryKey and headline are required" });
  const result = await appendChronicle(userId, entryKey, headline, {
    detail,
    chapterNumber: chapterNumber ?? 0,
  });
  res.status(result.isNew ? 201 : 200).json(result);
});
