import type { User } from "@shared/schema";

export interface LevelUpResult {
  level: number;
  experience: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  statPoints: number;
}

/**
 * Applies experience gain to a user and returns the updated stats.
 * Extracted as a shared helper to eliminate the identical level-up loop
 * that was duplicated across field, boss, and special-boss battle routes.
 */
export function applyExpGain(user: User, expGained: number): LevelUpResult {
  let currentExp    = user.experience + expGained;
  let currentLevel  = user.level;
  let currentMaxHp  = user.maxHp;
  let currentAtk    = user.attack;
  let currentDef    = user.defense;
  let currentSpd    = user.speed;
  let currentSP     = user.statPoints || 0;

  while (currentExp >= Math.floor(100 * Math.pow(1.25, currentLevel - 1))) {
    currentExp -= Math.floor(100 * Math.pow(1.25, currentLevel - 1));
    currentSP += Math.floor(currentLevel / 5) + 3;
    currentLevel++;
    currentMaxHp += 20;
    currentAtk   += 5;
    currentDef   += 3;
    currentSpd   += 2;
  }

  return {
    level:       currentLevel,
    experience:  currentExp,
    maxHp:       currentMaxHp,
    attack:      currentAtk,
    defense:     currentDef,
    speed:       currentSpd,
    statPoints:  currentSP,
  };
}

export function calcExpToNext(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

export function calcEquipExpToNext(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}
