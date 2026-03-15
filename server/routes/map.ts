import { Router } from "express";
import { db } from "../db";
import { heldProvinces } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export const mapRouter = Router();

// GET /api/map/provinces
// Returns all provinces this player has conquered.
mapRouter.get("/provinces", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const rows   = await db
      .select()
      .from(heldProvinces)
      .where(eq(heldProvinces.userId, userId));
    res.json(rows.map(r => ({
      ...r,
      heldAt: r.heldAt instanceof Date ? r.heldAt.toISOString() : r.heldAt,
    })));
  } catch (err) {
    console.error("[map] GET /provinces", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/map/provinces/:id/hold
// Upsert: mark a province as held (or refresh an existing conquest).
mapRouter.post("/provinces/:id/hold", async (req: any, res) => {
  try {
    const userId     = req.user.claims.sub;
    const locationId = Number(req.params.id);
    if (!locationId || isNaN(locationId))
      return res.status(400).json({ message: "Invalid locationId" });

    const bossDefeated: boolean =
      req.body?.bossDefeated !== undefined ? Boolean(req.body.bossDefeated) : true;

    // Check for existing row
    const [existing] = await db
      .select()
      .from(heldProvinces)
      .where(and(
        eq(heldProvinces.userId, userId),
        eq(heldProvinces.locationId, locationId),
      ));

    let row;
    if (existing) {
      // Update heldAt + bossDefeated (once true, never reverts)
      [row] = await db
        .update(heldProvinces)
        .set({
          heldAt:       new Date(),
          bossDefeated: existing.bossDefeated || bossDefeated,
        })
        .where(eq(heldProvinces.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(heldProvinces)
        .values({ userId, locationId, bossDefeated, heldAt: new Date() })
        .returning();
    }

    res.json({
      ...row,
      heldAt: row.heldAt instanceof Date ? row.heldAt.toISOString() : row.heldAt,
    });
  } catch (err) {
    console.error("[map] POST /provinces/:id/hold", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
