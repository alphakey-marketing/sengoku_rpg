/**
 * storyFlagModifiers.ts
 * ─────────────────────────────────────────────────────────────────────
 * Reads a player's accumulated story flags from the DB and converts them
 * into combat stat multipliers applied before every battle.
 *
 * Design rules:
 *  - All multipliers are ADDITIVE on top of the existing stat stack
 *    (equipment → horse → transformation → flags).
 *  - Each flag is clamped so extreme scores don't produce runaway stats.
 *  - Negative loyalty scores are real penalties — the story has consequences.
 *  - Zero-flag players are completely unaffected (modifiers default to 1.0).
 */

import { storage } from "../storage";

export interface FlagModifiers {
  /** Multiply player + companion ATK by this value */
  atkMult:      number;
  /** Multiply player + companion DEF by this value */
  defMult:      number;
  /** Multiply player + companion SPD by this value */
  spdMult:      number;
  /** Multiply player + companion HP by this value */
  hpMult:       number;
  /** When true, adds a spirit-world debuff line to the battle log */
  spiritDebuff: boolean;
  /** How many fewer enemies to spawn in a field multi-battle (min 0) */
  enemyReduction: number;
  /** Human-readable lines to prepend to the battle log */
  logLines:     string[];
}

const DEFAULT: FlagModifiers = {
  atkMult:       1.0,
  defMult:       1.0,
  spdMult:       1.0,
  hpMult:        1.0,
  spiritDebuff:  false,
  enemyReduction: 0,
  logLines:      [],
};

/**
 * Clamps a flag score to a [min, max] range then scales it linearly
 * to a multiplier between 1+minBonus and 1+maxBonus.
 *
 * Example: clampedMult(8, 0, 10, 0, 0.20) → 1.16
 */
function clampedMult(
  score:    number,
  minScore: number,
  maxScore: number,
  minBonus: number,
  maxBonus: number,
): number {
  const clamped = Math.max(minScore, Math.min(maxScore, score));
  const t       = (clamped - minScore) / (maxScore - minScore || 1);
  return 1 + minBonus + t * (maxBonus - minBonus);
}

export async function getFlagModifiers(userId: string): Promise<FlagModifiers> {
  // Fetch all flags for this player in one query
  const rows = await storage.getPlayerFlags(userId);
  if (!rows || rows.length === 0) return { ...DEFAULT };

  const flagMap: Record<string, number> = {};
  for (const row of rows) flagMap[row.flagKey] = row.flagValue;

  const mods: FlagModifiers = { ...DEFAULT, logLines: [] };

  // ── ruthlessness → +ATK (up to +20%) ───────────────────────────────────
  const ruthless = flagMap["ruthlessness"] ?? 0;
  if (ruthless > 0) {
    mods.atkMult = clampedMult(ruthless, 0, 10, 0, 0.20);
    const pct    = Math.round((mods.atkMult - 1) * 100);
    mods.logLines.push(`[Ruthless] +${pct}% ATK from story choices`);
  }

  // ── political_power → +DEF (up to +15%) + enemy reduction ────────────────
  const political = flagMap["political_power"] ?? 0;
  if (political > 0) {
    mods.defMult      = clampedMult(political, 0, 10, 0, 0.15);
    const pct         = Math.round((mods.defMult - 1) * 100);
    mods.logLines.push(`[Political] +${pct}% DEF from story choices`);
    // Reduce opponent count by 1 for every 5 political points (max 2)
    mods.enemyReduction = Math.min(2, Math.floor(political / 5));
    if (mods.enemyReduction > 0) {
      mods.logLines.push(`[Political] Your manoeuvring thinned enemy ranks (−${mods.enemyReduction} encounter${mods.enemyReduction > 1 ? 's' : ''})`);
    }
  }

  // ── supernatural_affinity → +SPD (up to +10%) + spirit debuff ───────────
  const supernatural = flagMap["supernatural_affinity"] ?? 0;
  if (supernatural > 0) {
    mods.spdMult      = clampedMult(supernatural, 0, 10, 0, 0.10);
    const pct         = Math.round((mods.spdMult - 1) * 100);
    mods.spiritDebuff = true;
    mods.logLines.push(`[Spirit World] +${pct}% SPD — the cursed blade resonates`);
  } else if (supernatural < 0) {
    // Chose to destroy the blade — small SPD penalty from superstition among your men
    mods.spdMult = clampedMult(supernatural, -5, 0, -0.05, 0);
    const pct    = Math.round((1 - mods.spdMult) * 100);
    if (pct > 0) mods.logLines.push(`[Pragmatist] −${pct}% SPD — some men are still unsettled`);
  }

  // ── mitsuhide_loyalty → +HP (up to +12%) or −HP penalty ────────────────
  const mitsuhide = flagMap["mitsuhide_loyalty"] ?? 0;
  if (mitsuhide > 0) {
    mods.hpMult  = clampedMult(mitsuhide, 0, 6, 0, 0.12);
    const pct    = Math.round((mods.hpMult - 1) * 100);
    mods.logLines.push(`[Mitsuhide] +${pct}% HP — his careful planning protects you`);
  } else if (mitsuhide < 0) {
    mods.hpMult  = clampedMult(mitsuhide, -3, 0, -0.08, 0);
    const pct    = Math.round((1 - mods.hpMult) * 100);
    if (pct > 0) mods.logLines.push(`[Resentment] −${pct}% HP — Mitsuhide's loyalty wavers`);
  }

  return mods;
}

/**
 * Mutates teamStats in-place, applying flag multipliers to all
 * player + companion combat stats.
 */
export function applyFlagModifiers(
  teamStats: ReturnType<Awaited<ReturnType<typeof import('../helpers/teamStats').getPlayerTeamStats>>> extends null ? never : NonNullable<Awaited<ReturnType<typeof import('../helpers/teamStats').getPlayerTeamStats>>>,
  mods:      FlagModifiers,
): void {
  if (
    mods.atkMult === 1 &&
    mods.defMult === 1 &&
    mods.spdMult === 1 &&
    mods.hpMult  === 1 &&
    !mods.spiritDebuff
  ) return; // no-op for players with no flags

  const members = [teamStats.player, ...teamStats.companions];

  for (const m of members) {
    if (mods.atkMult !== 1) m.attack  = Math.floor(m.attack  * mods.atkMult);
    if (mods.defMult !== 1) m.defense = Math.floor(m.defense * mods.defMult);
    if (mods.spdMult !== 1) m.speed   = Math.floor(m.speed   * mods.spdMult);
    if (mods.hpMult  !== 1) {
      const hpBonus = Math.floor(m.maxHp * (mods.hpMult - 1));
      m.maxHp += hpBonus;
      m.hp    = Math.min(m.hp + hpBonus, m.maxHp);
    }
    if (mods.spiritDebuff) {
      // Carries the flag through to combat engine for future debuff expansion
      m.spiritDebuff = true;
    }
  }
}
