import { db } from "../db";
import { playerFlags } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getPlayerFlagMap(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select()
    .from(playerFlags)
    .where(eq(playerFlags.userId, userId));
  const out: Record<string, number> = {};
  for (const row of rows) out[row.flagKey] = row.flagValue;
  return out;
}
