// server/combat.ts
// ─────────────────────────────────────────────────────────────────────────────
// Simplified combat resolver.
//
// Design principle: this game is story-first. Combat exists only to produce
// a victory/defeat signal and a short log for the UI. All narrative
// consequence lives in story-routes.ts (battle-result endpoint).
//
// Public API (unchanged from original so battle.ts needs zero edits):
//   applyFlagModifiers(userId, team, enemies) → Promise<string[]>
//   runTurnBasedCombat(playerTeam, enemies)   → CombatResult
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db";
import { playerFlags } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { EnemyStats, TeamStats } from "../client/src/hooks/use-game";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  isPlayer: boolean;
}

export interface CombatResult {
  victory: boolean;
  logs: string[];
  turn: number;
  timeout?: boolean;
}

// ── Core formula ──────────────────────────────────────────────────────────────
//
// Damage = attacker.attack − (defender.defense × 0.5), minimum 1.
// Deterministic: no RNG, no crits, no hit/miss.
// The player's attack and defense already encode all stat investment from
// player-stats.ts — no need to re-derive them here.

function resolveDamage(attacker: CombatUnit, defender: CombatUnit): number {
  const raw = attacker.attack - Math.floor(defender.defense * 0.5);
  return Math.max(1, raw);
}

// ── Unit builder ──────────────────────────────────────────────────────────────

function buildUnit(
  id: string,
  name: string,
  hp: number,
  attack: number,
  defense: number,
  speed: number,
  isPlayer: boolean,
): CombatUnit {
  const safeHp  = Math.max(1, Number(hp)      || 1);
  const safeAtk = Math.max(1, Number(attack)  || 1);
  const safeDef = Math.max(0, Number(defense) || 0);
  const safeSpd = Math.max(1, Number(speed)   || 1);
  return { id, name, hp: safeHp, maxHp: safeHp, attack: safeAtk, defense: safeDef, speed: safeSpd, isPlayer };
}

// ── Flag modifiers ────────────────────────────────────────────────────────────
//
// Reads story flags and returns narrative log lines describing the
// pre-combat advantage. Stat bonuses (ATK%, HP%) are already baked into
// teamStats by player-stats.ts before this is called, so this function
// only handles effects that operate on the ENEMY ARRAY directly
// (enemy count trimming via political_power) and produces log lines
// the player can see. No mutation of player stats here.
//
// Export kept so battle.ts imports compile without changes.

export async function applyFlagModifiers(
  userId: string,
  _team: TeamStats,
  enemies: EnemyStats[],
): Promise<string[]> {
  const logs: string[] = [];

  const rows = await db.select().from(playerFlags).where(eq(playerFlags.userId, userId));
  const flags: Record<string, number> = {};
  for (const r of rows) flags[r.flagKey] = r.flagValue;

  const ruthlessness = flags.ruthlessness          ?? 0;
  const supernatural = flags.supernatural_affinity ?? 0;
  const political    = flags.political_power       ?? 0;
  const loyalty      = flags.mitsuhide_loyalty     ?? 0;
  const loyaltyAmp   = 1 + Math.min(0.20, loyalty * 0.02);

  if (ruthlessness > 0) {
    const pct = Math.round(Math.min(50, ruthlessness * 5) * loyaltyAmp);
    logs.push(`[Force +${pct}%] The blood of your past choices fuels your blade.`);
  }

  if (supernatural >= 1) {
    const pct = Math.round(Math.min(40, supernatural * 4) * loyaltyAmp);
    logs.push(`[Spirit +${pct}% HP] Unseen forces unnerve the enemy — their armour falters.`);
  }

  const trim = Math.min(enemies.length - 1, Math.floor(political / 3));
  if (trim > 0) {
    enemies.splice(enemies.length - trim, trim);
    logs.push(`[Influence] Your name alone disbands ${trim} enemy unit${trim > 1 ? "s" : ""}.`);
  }

  if (loyalty > 0) {
    logs.push(`[Mitsuhide] His unwavering loyalty amplifies your every advantage.`);
  }

  return logs;
}

// ── Turn-based combat resolver ────────────────────────────────────────────────
//
// Resolves combat in a simple alternating loop:
//   1. All player units (player + companions) attack, targeting enemies in order.
//   2. All surviving enemies attack the player.
//   3. Check win/lose conditions.
//
// No RNG on hit/miss, no crits, no status effects, no multi-attack scaling.
// Companions contribute their attack naturally; the player benefits from
// any stat bonuses granted by player-stats.ts before this is called.
//
// Return shape is identical to the original so all callers in battle.ts
// compile and behave correctly without changes.

export function runTurnBasedCombat(
  playerTeam: TeamStats,
  enemies: EnemyStats[],
): CombatResult {
  const logs: string[] = [];
  const MAX_TURNS = 20;

  // ── Build player units ─────────────────────────────────────────────────────
  const p = playerTeam.player;
  const playerUnits: CombatUnit[] = [
    buildUnit(
      "player",
      p.name,
      Number(p.hp)      || 1,
      Number(p.attack)  || 1,
      Number(p.defense) || 0,
      Number((p as any).speed || (p as any).agi || 10),
      true,
    ),
  ];

  for (let i = 0; i < playerTeam.companions.length; i++) {
    const c = playerTeam.companions[i];
    playerUnits.push(
      buildUnit(
        `comp-${i}`,
        c.name,
        Number(c.hp)      || 1,
        Number(c.attack)  || 1,
        Number(c.defense) || 0,
        Number((c as any).speed || (c as any).agi || 10),
        true,
      ),
    );
  }

  // ── Build enemy units ──────────────────────────────────────────────────────
  const enemyUnits: CombatUnit[] = enemies.map((e, i) =>
    buildUnit(
      `enemy-${i}`,
      e.name,
      Number(e.hp)      || 1,
      Number(e.attack)  || 1,
      Number(e.defense) || 0,
      Number((e as any).speed || (e as any).agi || 10),
      false,
    ),
  );

  // ── Turn loop ──────────────────────────────────────────────────────────────
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    logs.push(`--- TURN ${turn} ---`);

    // Player side attacks
    for (const unit of playerUnits.filter(u => u.hp > 0)) {
      const target = enemyUnits.find(e => e.hp > 0);
      if (!target) break;
      const dmg = resolveDamage(unit, target);
      target.hp -= dmg;
      logs.push(`${unit.name} strikes ${target.name} for ${dmg} damage.`);
      if (target.hp <= 0) logs.push(`${target.name} has been defeated!`);
    }

    if (enemyUnits.every(e => e.hp <= 0)) {
      logs.push("Victory! All enemies defeated.");
      return { victory: true, logs, turn };
    }

    // Enemy side attacks
    const playerTarget = playerUnits.find(u => u.hp > 0);
    if (playerTarget) {
      for (const enemy of enemyUnits.filter(e => e.hp > 0)) {
        const dmg = resolveDamage(enemy, playerTarget);
        playerTarget.hp -= dmg;
        logs.push(`${enemy.name} strikes ${playerTarget.name} for ${dmg} damage.`);
        if (playerTarget.hp <= 0) {
          logs.push(`${playerTarget.name} has fallen!`);
          break;
        }
      }
    }

    if (playerUnits.every(u => u.hp <= 0)) {
      logs.push("Defeat! Your team was wiped out.");
      return { victory: false, logs, turn };
    }
  }

  logs.push("Timeout! Battle exceeded 20 turns.");
  return { victory: false, logs, turn: MAX_TURNS, timeout: true };
}
