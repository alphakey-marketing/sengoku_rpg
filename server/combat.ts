import { db } from "./db";
import { playerFlags } from "@shared/schema";
import { eq } from "drizzle-orm";
import { EnemyStats, TeamStats } from "../client/src/hooks/use-game";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeaponType =
  | "dagger"
  | "sword"
  | "twoHandSword"
  | "axe"
  | "mace"
  | "spear"
  | "knuckle"
  | "katar"
  | "book"
  | "staff"
  | "bow"
  | "gun"
  | "instrument"
  | "whip"
  | "none";

export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  aspd?: number;
  weaponType?: WeaponType;

  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  dex?: number;
  luk?: number;

  hardDEF?: number;
  softDEF?: number;

  weaponATK?: number;
  weaponLevel?: number;
  refinementBonus?: number;
  bonusATK?: number;

  hit?: number;
  flee?: number;
  critChance: number;
  critDamage: number;
  isPlayer: boolean;
  stamina?: number;
  maxStamina?: number;
  statusEffects: { type: string; duration: number; value?: number }[];
  isGuarding: boolean;
  endowmentPoints?: number;
}

// ─── Weapon helpers ───────────────────────────────────────────────────────────

export function isMeleeWeapon(type: WeaponType | undefined): boolean {
  if (!type) return true;
  return ["dagger","sword","twoHandSword","axe","mace","spear","knuckle","katar","book","staff","none"].includes(type);
}

export function isRangedWeapon(type: WeaponType | undefined): boolean {
  if (!type) return false;
  return ["bow","gun","instrument","whip"].includes(type);
}

// ─── Hit / damage formulas ────────────────────────────────────────────────────

export function calculateHitChance(attacker: CombatUnit, defender: CombatUnit): number {
  const hit   = attacker.hit  ?? 0;
  const flee  = defender.flee ?? 0;
  return Math.min(95, Math.max(5, hit - flee));
}

function getStatusATK(attacker: CombatUnit): number {
  const lv  = (attacker as any).level ?? 1;
  const STR = attacker.str ?? 1;
  const DEX = attacker.dex ?? 1;
  const LUK = attacker.luk ?? 1;
  if (isRangedWeapon(attacker.weaponType)) {
    return Math.floor(lv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3);
  }
  return Math.floor(lv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
}

function getWeaponATKWithStatBonus(unit: CombatUnit): number {
  const base = unit.weaponATK ?? unit.attack ?? 0;
  const bonus = isRangedWeapon(unit.weaponType)
    ? 0.005 * (unit.dex ?? 1)
    : 0.005 * (unit.str ?? 1);
  return Math.floor(base * (1 + bonus));
}

function getWeaponRoll(attacker: CombatUnit): number {
  const weaponATK    = getWeaponATKWithStatBonus(attacker);
  const weaponLevel  = attacker.weaponLevel  ?? 1;
  const varianceRange = 0.05 * weaponLevel * weaponATK;
  const variance     = (Math.random() * 2 * varianceRange) - varianceRange;
  return Math.floor(weaponATK + variance + (attacker.refinementBonus ?? 0) + (attacker.bonusATK ?? 0));
}

function getTotalATK(attacker: CombatUnit): number {
  return getStatusATK(attacker) + getWeaponRoll(attacker);
}

export function calculateDamage(attacker: CombatUnit, defender: CombatUnit, isCritical = false): number {
  let damage = getTotalATK(attacker);

  // Apply spirit_debuff: each stack reduces hardDEF by 10%
  const spiritDebuffs = defender.statusEffects.filter(s => s.type === "spirit_debuff").length;
  const hardDEF = Math.max(0, (defender.hardDEF ?? defender.defense ?? 0) * Math.pow(0.9, spiritDebuffs));
  damage = Math.floor(damage * (100 / (100 + hardDEF)));

  const softDEF = Math.floor((defender.vit ?? 1) / 2) + Math.floor((defender.agi ?? 1) / 5) + (defender.softDEF ?? 0);
  damage = Math.max(1, damage - softDEF);

  if (isCritical) {
    damage = Math.floor(damage * (1.5 + (attacker.critDamage ?? 0) / 100));
  }

  const endow = Math.min(0.35, ((defender as any).endowmentPoints ?? 0) * 0.5 / 100);
  damage = Math.floor(damage * (1 - endow));

  if (defender.isGuarding) damage = Math.floor(damage * 0.7);

  return Math.max(1, damage);
}

// ─── A1: Flag-modified battle stats (continuous, story-driven) ────────────────
//
// Each story flag applies a soft, incremental bonus that scales directly with
// the raw flag value earned through Chapter choices — no hard thresholds.
//
//  ruthlessness          → +5% ATK per point (cap +50%) for every player unit
//  supernatural_affinity → +4% HP per point (cap +40%); at ≥1 all enemies
//                          gain a spirit_debuff (−10% effective hardDEF)
//  political_power       → enemy count trimmed by 1 per 3 points (min 1 enemy)
//  mitsuhide_loyalty     → amplifies all three above bonuses by +2% per point
//                          (cap +20% amplification)
//
// NOTE: ATK and HP bonuses are already baked into the team stats by
// player-stats.ts before combat runs. applyFlagModifiers here only handles
// effects that must be applied TO THE ENEMY ARRAY (spirit_debuff, enemy trim)
// and appends narrative log lines so the player can see the effect.

export async function applyFlagModifiers(
  userId: string,
  team: TeamStats,
  enemies: EnemyStats[],
): Promise<string[]> {
  const modifierLog: string[] = [];

  const rows = await db.select().from(playerFlags).where(eq(playerFlags.userId, userId));
  const flags: Record<string, number> = {};
  for (const r of rows) flags[r.flagKey] = r.flagValue;

  const ruthlessness   = flags.ruthlessness          ?? 0;
  const supernatural   = flags.supernatural_affinity ?? 0;
  const political      = flags.political_power       ?? 0;
  const loyalty        = flags.mitsuhide_loyalty     ?? 0;
  const loyaltyAmp     = 1 + Math.min(0.20, loyalty * 0.02);

  // ── ruthlessness → narrative ATK log (bonuses already in team stats) ──────
  if (ruthlessness > 0) {
    const pct = Math.round(Math.min(50, ruthlessness * 5) * loyaltyAmp);
    modifierLog.push(`[Force +${pct}%] The blood of your past choices fuels your blade.`);
  }

  // ── supernatural_affinity → spirit_debuff on every enemy ─────────────────
  if (supernatural >= 1) {
    for (const e of enemies) {
      if (!(e as any).statusEffects) (e as any).statusEffects = [];
      (e as any).statusEffects.push({ type: "spirit_debuff", duration: 99, value: 0.1 });
    }
    const pct = Math.round(Math.min(40, supernatural * 4) * loyaltyAmp);
    modifierLog.push(`[Spirit +${pct}% HP] Unseen forces unnerve the enemy — their armour falters.`);
  }

  // ── political_power → reduce enemy count (1 fewer per 3 pts, min 1) ──────
  const trim = Math.min(enemies.length - 1, Math.floor(political / 3));
  if (trim > 0) {
    enemies.splice(enemies.length - trim, trim);
    modifierLog.push(`[Influence] Your name alone disbands ${trim} enemy unit${trim > 1 ? "s" : ""}.`);
  }

  // ── mitsuhide_loyalty → narrative amplifier log ───────────────────────────
  if (loyalty > 0) {
    modifierLog.push(`[Mitsuhide] His unwavering loyalty amplifies your every advantage.`);
  }

  return modifierLog;
}

// ─── Turn-based combat resolver ───────────────────────────────────────────────

export function runTurnBasedCombat(playerTeam: TeamStats, enemies: EnemyStats[]) {
  const logs: string[] = [];
  const units: CombatUnit[] = [];

  // ── Build player unit ────────────────────────────────────────────────────
  const p     = playerTeam.player;
  const pAGI  = Number((p as any).agi  || 1);
  const pDEX  = Number((p as any).dex  || 1);
  const pLUK  = Number((p as any).luk  || 1);
  const pLv   = Number((p as any).level || 1);

  units.push({
    id: "player",
    name: p.name,
    hp:     Number(p.hp)     || 0,
    maxHp:  Number(p.maxHp)  || 0,
    attack: Number(p.attack) || 0,
    defense: Number(p.defense) || 0,
    aspd:   100 + pAGI + Math.floor(pDEX / 4),
    str:    Number((p as any).str  || 1),
    agi:    pAGI,
    vit:    Number((p as any).vit  || 1),
    int:    Number((p as any).int  || 1),
    dex:    pDEX,
    luk:    pLUK,
    hardDEF:       Number(p.defense) || 0,
    softDEF:       0,
    weaponATK:     Number((p as any).weaponATK  || p.attack) || 0,
    weaponLevel:   Number((p as any).weaponLevel || 1),
    weaponType:    (p as any).weaponType,
    refinementBonus: 0,
    bonusATK:      Number((p as any).bonusATK || 0),
    hit:  175 + pLv + pDEX + Math.floor(pLUK / 3),
    flee: 100 + pLv + pAGI + Math.floor(pLUK / 5) + Math.floor(pLUK / 10),
    critChance: Number((p as any).critChance) || 0,
    critDamage: Number((p as any).critDamage) || 0,
    isPlayer: true,
    stamina: 100, maxStamina: 100,
    statusEffects: [],
    isGuarding: false,
    endowmentPoints: Number((p as any).endowmentPoints) || 0,
    level: pLv,
  } as any);

  // ── Build companion units ────────────────────────────────────────────────
  for (let i = 0; i < playerTeam.companions.length; i++) {
    const c    = playerTeam.companions[i];
    const cLv  = Number(c.level)  || 1;
    const cAGI = Number((c as any).agi || 10);
    const cDEX = Number((c as any).dex || 10);
    const cLUK = Number((c as any).luk || 1);
    units.push({
      id: `comp-${i}`,
      name:    c.name,
      hp:      Number(c.hp)     || 0,
      maxHp:   Number(c.maxHp)  || 0,
      attack:  Number(c.attack) || 0,
      defense: Number(c.defense) || 0,
      aspd:    100 + cAGI + Math.floor(cDEX / 4),
      weaponType: (c as any).weaponType,
      str: Number((c as any).str || 10),
      agi: cAGI,
      vit: Number((c as any).vit || 10),
      int: Number((c as any).int || 10),
      dex: cDEX,
      luk: cLUK,
      hardDEF:       Number(c.defense) || 0,
      softDEF:       0,
      weaponATK:     Number((c as any).weaponATK || c.attack) || 0,
      weaponLevel:   1,
      refinementBonus: 0,
      bonusATK:      Number((c as any).bonusATK || 0),
      hit:  175 + cLv + cDEX + Math.floor(cLUK / 3),
      flee: 100 + cLv + cAGI + Math.floor(cLUK / 5) + Math.floor(cLUK / 10),
      critChance: Number((c as any).critChance) || 0,
      critDamage: 0,
      isPlayer: true,
      statusEffects: [],
      isGuarding: false,
      endowmentPoints: Number((c as any).endowmentPoints) || 0,
      level: cLv,
    } as any);
  }

  // ── Build enemy units ────────────────────────────────────────────────────
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    units.push({
      id: `enemy-${i}`,
      name:    e.name,
      hp:      Number(e.hp)      || 0,
      maxHp:   Number(e.maxHp)   || 0,
      attack:  (e as any).weaponATK ?? e.attack ?? 0,
      defense: (e as any).hardDEF  ?? e.defense ?? 0,
      aspd:    100 + (Number((e as any).agi) || 10) + Math.floor((Number((e as any).dex) || 10) / 4),
      weaponType: (e as any).weaponType,
      str: (e as any).str,
      agi: (e as any).agi,
      vit: (e as any).vit,
      int: (e as any).int,
      dex: (e as any).dex,
      luk: (e as any).luk,
      hardDEF:       (e as any).hardDEF,
      softDEF:       (e as any).softDEF ?? 0,
      weaponATK:     (e as any).weaponATK ?? e.attack ?? 0,
      weaponLevel:   (e as any).weaponLevel ?? 1,
      hit:  (e as any).hit,
      flee: (e as any).flee,
      isPlayer: false,
      statusEffects: (e as any).statusEffects ?? [],
      isGuarding: false,
      critChance: 0,
      critDamage: 0,
      level: Number(e.level) || 1,
    } as any);
  }

  // ── Turn loop ────────────────────────────────────────────────────────────
  let turn = 0;
  const MAX_TURNS = 20;

  while (turn < MAX_TURNS) {
    turn++;
    logs.push(`--- TURN ${turn} ---`);

    units.sort((a, b) => (b.aspd ?? 0) - (a.aspd ?? 0));

    for (const unit of units) {
      if (unit.hp <= 0) continue;

      const numAttacks = Math.min(5, Math.max(1, Math.floor((unit.aspd ?? 100) / 100)));

      for (let i = 0; i < numAttacks; i++) {
        const enemiesAlive = units.some(u => !u.isPlayer && u.hp > 0);
        const playerAlive  = units.some(u =>  u.isPlayer && u.hp > 0);
        if (!enemiesAlive || !playerAlive) break;

        const stunIdx = unit.statusEffects.findIndex(s => s.type === "Stun");
        if (stunIdx !== -1) {
          logs.push(`${unit.name} is stunned and skips attack!`);
          unit.statusEffects.splice(stunIdx, 1);
          break;
        }

        const targets = units.filter(u => u.isPlayer !== unit.isPlayer && u.hp > 0);
        if (targets.length === 0) break;
        const target = targets[Math.floor(Math.random() * targets.length)];

        const hitRoll = Math.random() * 100;
        if (hitRoll > calculateHitChance(unit, target)) {
          logs.push(`${unit.name} attacks ${target.name} but MISSES!`);
        } else {
          const isCrit   = (Math.random() * 100) < ((unit.critChance || 0) + 5);
          const damage   = calculateDamage(unit, target, isCrit);
          target.hp     -= damage;
          logs.push(`${unit.name} attacks ${target.name} for ${damage}${isCrit ? " (CRITICAL!)" : ""} damage.`);
        }

        if (unit.name.toLowerCase().includes("ninja") && Math.random() < 0.3) {
          target.statusEffects.push({ type: "Stun", duration: 1 });
          logs.push(`${target.name} was stunned!`);
        }

        if (target.hp <= 0) logs.push(`${target.name} has been KO'd!`);
      }

      const poisonIdx = unit.statusEffects.findIndex(s => s.type === "Poison");
      if (poisonIdx !== -1) {
        const dot = Math.floor(unit.maxHp * 0.05);
        unit.hp  -= dot;
        logs.push(`${unit.name} took ${dot} poison damage.`);
        if (unit.hp <= 0) logs.push(`${unit.name} was defeated by poison!`);
      }

      unit.isGuarding = false;
    }

    const allEnemiesDead = units.every(u => u.isPlayer || u.hp <= 0);
    const allPlayersDead = units.every(u => !u.isPlayer || u.hp <= 0);

    if (allEnemiesDead) {
      logs.push("Victory! All enemies defeated.");
      return { victory: true, logs, turn };
    }
    if (allPlayersDead) {
      logs.push("Defeat! Your team was wiped out.");
      return { victory: false, logs, turn };
    }
  }

  logs.push("Timeout! Battle exceeded 20 turns.");
  return { victory: false, logs, turn, timeout: true };
}
