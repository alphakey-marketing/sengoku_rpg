import { db } from "../db";
import { chronicleEntries } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getPlayerFlagMap } from "./flag-map";

/**
 * Append a Chronicle Wall entry for a player milestone.
 *
 * Idempotent: if entryKey already exists for this user the call is a no-op
 * and returns the existing row. This means battle/story code can call it
 * freely without worrying about duplicates.
 *
 * flagMap: if omitted, the live flag map is fetched automatically.
 */
export async function appendChronicle(
  userId: string,
  entryKey: string,
  headline: string,
  opts: {
    detail?: string;
    chapterNumber?: number;
    flagMap?: Record<string, number>;
  } = {},
): Promise<{ entry: any; isNew: boolean }> {
  // Idempotency check
  const [existing] = await db
    .select()
    .from(chronicleEntries)
    .where(
      and(
        eq(chronicleEntries.userId, userId),
        eq(chronicleEntries.entryKey, entryKey),
      ),
    );
  if (existing) return { entry: existing, isNew: false };

  // Capture flag snapshot
  const flagSnapshot = opts.flagMap ?? (await getPlayerFlagMap(userId));

  const [entry] = await db
    .insert(chronicleEntries)
    .values({
      userId,
      entryKey,
      headline,
      detail:        opts.detail        ?? null,
      chapterNumber: opts.chapterNumber ?? 0,
      flagSnapshot,
      recordedAt: new Date(),
    })
    .returning();

  return { entry, isNew: true };
}
