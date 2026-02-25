import { EnemyStats, TeamStats } from "../client/src/hooks/use-game";

export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;

  // New RO Stats
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
  statusEffects: { type: string; duration: number }[];
  isGuarding: boolean;
  endowmentPoints?: number;
}

export function calculateHitChance(attacker: CombatUnit, defender: CombatUnit): number {
  const attackerHit = attacker.hit ?? 0;
  const defenderFlee = defender.flee ?? 0;
  let hitChance = attackerHit - defenderFlee;
  if (hitChance < 5) hitChance = 5;
  if (hitChance > 95) hitChance = 95;
  return hitChance;
}

function getStatusATK(attacker: CombatUnit, isRanged: boolean): number {
  const lv = (attacker as any).level ?? 1;
  const STR = attacker.str ?? 1;
  const DEX = attacker.dex ?? 1;
  const LUK = attacker.luk ?? 1;

  if (!isRanged) {
    return Math.floor(lv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
  } else {
    return Math.floor(lv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3);
  }
}

function getWeaponRoll(attacker: CombatUnit): number {
  const baseWeaponATK = attacker.weaponATK ?? attacker.attack ?? 0;
  const weaponLevel = attacker.weaponLevel ?? 1;
  const varianceRange = 0.05 * weaponLevel * baseWeaponATK;
  const variance = (Math.random() * 2 * varianceRange) - varianceRange;
  const refinementBonus = attacker.refinementBonus ?? 0;
  const bonusATK = attacker.bonusATK ?? 0;
  return Math.floor(baseWeaponATK + variance + refinementBonus + bonusATK);
}

function getTotalATK(attacker: CombatUnit, isRanged: boolean): number {
  const statusATK = getStatusATK(attacker, isRanged);
  const weaponRoll = getWeaponRoll(attacker);
  return statusATK + weaponRoll;
}

export function calculateDamage(
  attacker: CombatUnit,
  defender: CombatUnit,
  isCritical: boolean = false,
  isRanged: boolean = false
) {
  const rawATK = getTotalATK(attacker, isRanged);
  let damage = rawATK;

  const hardDEF = defender.hardDEF ?? defender.defense ?? 0;
  const hardFactor = 100 / (100 + Math.max(0, hardDEF));
  damage = Math.floor(damage * hardFactor);

  const VIT = defender.vit ?? 1;
  const AGI = defender.agi ?? 1;
  const softFromStats = Math.floor(VIT / 2) + Math.floor(AGI / 5);
  const extraSoft = defender.softDEF ?? 0;
  const softDEF = softFromStats + extraSoft;

  damage = damage - softDEF;
  if (damage < 1) damage = 1;

  if (isCritical) {
    const critBonus = attacker.critDamage ?? 0;
    const critMult = 1.5 + (critBonus / 100);
    damage = Math.floor(damage * critMult);
  }

  const endowmentPoints = Number((defender as any).endowmentPoints) || 0;
  const damageReduction = Math.min(0.35, (endowmentPoints * 0.5) / 100);
  damage = Math.floor(damage * (1 - damageReduction));

  if (defender.isGuarding) {
    damage = Math.floor(damage * 0.7);
  }

  if (damage < 1) damage = 1;
  return damage;
}

export function runTurnBasedCombat(playerTeam: TeamStats, enemies: EnemyStats[]) {
  const logs: string[] = [];
  const units: CombatUnit[] = [];

  units.push({
    id: 'player',
    name: playerTeam.player.name,
    hp: Number(playerTeam.player.hp) || 0,
    maxHp: Number(playerTeam.player.maxHp) || 0,
    attack: Number(playerTeam.player.attack) || 0,
    defense: Number(playerTeam.player.defense) || 0,
    speed: Number(playerTeam.player.speed) || 0,
    str: Number((playerTeam.player as any).str || 1),
    agi: Number((playerTeam.player as any).agi || 1),
    vit: Number((playerTeam.player as any).vit || 1),
    int: Number((playerTeam.player as any).int || 1),
    dex: Number((playerTeam.player as any).dex || 1),
    luk: Number((playerTeam.player as any).luk || 1),
    hardDEF: Number(playerTeam.player.defense) || 0,
    softDEF: 0,
    weaponATK: Number(playerTeam.player.attack) || 0,
    weaponLevel: 1,
    refinementBonus: 0,
    bonusATK: 0,
    hit: ((): number => {
      const lv = Number((playerTeam.player as any).level || 1);
      const DEX = Number((playerTeam.player as any).dex || 1);
      const LUK = Number((playerTeam.player as any).luk || 1);
      return 175 + lv + DEX + Math.floor(LUK / 3);
    })(),
    flee: ((): number => {
      const lv = Number((playerTeam.player as any).level || 1);
      const AGI = Number((playerTeam.player as any).agi || 1);
      const LUK = Number((playerTeam.player as any).luk || 1);
      const fleeA = 100 + lv + AGI + Math.floor(LUK / 5);
      const perfectDodge = Math.floor(LUK / 10);
      return fleeA + perfectDodge;
    })(),
    critChance: Number((playerTeam.player as any).critChance) || 0,
    critDamage: Number((playerTeam.player as any).critDamage) || 0,
    isPlayer: true,
    stamina: 100,
    maxStamina: 100,
    statusEffects: [],
    isGuarding: false,
    endowmentPoints: Number((playerTeam.player as any).endowmentPoints) || 0,
    level: Number((playerTeam.player as any).level || 1)
  } as any);

  playerTeam.companions.forEach((c, i) => {
    const cLevel = Number(c.level) || 1;
    const cDEX = Number((c as any).dex || 10);
    const cAGI = Number((c as any).agi || 10);
    const cLUK = Number((c as any).luk || 1);
    units.push({
      id: `comp-${i}`,
      name: c.name,
      hp: Number(c.hp) || 0,
      maxHp: Number(c.maxHp) || 0,
      attack: Number(c.attack) || 0,
      defense: Number(c.defense) || 0,
      speed: Number(c.speed) || 0,
      str: Number((c as any).str || 10),
      agi: cAGI,
      vit: Number((c as any).vit || 10),
      int: Number((c as any).int || 10),
      dex: cDEX,
      luk: cLUK,
      hardDEF: Number(c.defense) || 0,
      softDEF: 0,
      weaponATK: Number(c.attack) || 0,
      weaponLevel: 1,
      refinementBonus: 0,
      bonusATK: 0,
      hit: 175 + cLevel + cDEX + Math.floor(cLUK / 3),
      flee: ((): number => {
        const fleeA = 100 + cLevel + cAGI + Math.floor(cLUK / 5);
        const perfectDodge = Math.floor(cLUK / 10);
        return fleeA + perfectDodge;
      })(),
      critChance: Number((c as any).critChance) || 0,
      critDamage: Number((c as any).critDamage) || 0,
      isPlayer: true,
      statusEffects: [],
      isGuarding: false,
      endowmentPoints: Number((c as any).endowmentPoints) || 0,
      level: cLevel
    } as any);
  });

  enemies.forEach((e, i) => {
    const eLevel = Number(e.level) || 1;
    const eDEX = Number((e as any).dex || eLevel);
    const eAGI = Number((e as any).agi || eLevel);
    const eLUK = Number((e as any).luk || 1);
    units.push({
      id: `enemy-${i}`,
      name: e.name,
      hp: Number(e.hp) || 0,
      maxHp: Number(e.maxHp) || 0,
      attack: Number(e.attack) || 0,
      defense: Number(e.defense) || 0,
      speed: Number(e.speed) || 0,
      str: Number((e as any).str || eLevel),
      agi: eAGI,
      vit: Number((e as any).vit || eLevel),
      int: Number((e as any).int || eLevel),
      dex: eDEX,
      luk: eLUK,
      hardDEF: Number(e.defense) || 0,
      softDEF: 0,
      weaponATK: Number(e.attack) || 0,
      weaponLevel: 1,
      refinementBonus: 0,
      bonusATK: 0,
      hit: 175 + eLevel + eDEX + Math.floor(eLUK / 3),
      flee: ((): number => {
        const fleeA = 100 + eLevel + eAGI + Math.floor(eLUK / 5);
        const perfectDodge = Math.floor(eLUK / 10);
        return fleeA + perfectDodge;
      })(),
      isPlayer: false,
      statusEffects: [],
      isGuarding: false,
      critChance: 0,
      critDamage: 0,
      level: eLevel
    } as any);
  });

  let turn = 0;
  const maxTurns = 20;

  while (turn < maxTurns) {
    turn++;
    logs.push(`--- TURN ${turn} ---`);
    units.sort((a, b) => b.speed - a.speed);

    for (const unit of units) {
      if (unit.hp <= 0) continue;
      const enemyAlive = units.filter(u => !u.isPlayer && u.hp > 0).length > 0;
      const playerAlive = units.filter(u => u.isPlayer && u.hp > 0).length > 0;
      if (!enemyAlive || !playerAlive) break;

      const stun = unit.statusEffects.find(s => s.type === 'Stun');
      if (stun) {
        logs.push(`${unit.name} is stunned and skips turn!`);
        unit.statusEffects = unit.statusEffects.filter(s => s.type !== 'Stun');
        continue;
      }

      const poison = unit.statusEffects.find(s => s.type === 'Poison');
      if (poison) {
        const dot = Math.floor(unit.maxHp * 0.05);
        unit.hp -= dot;
        logs.push(`${unit.name} took ${dot} poison damage.`);
        if (unit.hp <= 0) {
          logs.push(`${unit.name} has been defeated by poison!`);
          continue;
        }
      }

      const targets = units.filter(u => u.isPlayer !== unit.isPlayer && u.hp > 0);
      if (targets.length === 0) break;
      const target = targets[Math.floor(Math.random() * targets.length)];

      const hitChance = calculateHitChance(unit, target);
      const roll = Math.random() * 100;

      if (roll > hitChance) {
        logs.push(`${unit.name} attacks ${target.name} but MISSES!`);
      } else {
        const critChance = (unit.critChance || 0) + 5;
        const isCrit = (Math.random() * 100) < critChance;
        const isRanged = false; 
        const damage = calculateDamage(unit, target, isCrit, isRanged);
        target.hp -= damage;
        logs.push(`${unit.name} attacks ${target.name} for ${damage}${isCrit ? ' (CRITICAL!)' : ''} damage.`);
      }

      if (unit.name.includes("Ninja") && Math.random() < 0.3) {
        target.statusEffects.push({ type: 'Stun', duration: 1 });
        logs.push(`${target.name} was stunned by the strike!`);
      }

      if (target.hp <= 0) {
        logs.push(`${target.name} has been KO'd!`);
      }
      unit.isGuarding = false;
    }

    const playerAlive = units.filter(u => u.isPlayer && u.hp > 0).length > 0;
    const enemyAlive = units.filter(u => !u.isPlayer && u.hp > 0).length > 0;

    if (!enemyAlive) {
      logs.push("Victory! All enemies defeated.");
      return { victory: true, logs, turn };
    }
    if (!playerAlive) {
      logs.push("Defeat! Your team was wiped out.");
      return { victory: false, logs, turn };
    }
  }

  logs.push("Timeout! Battle exceeded 20 turns.");
  return { victory: false, logs, turn, timeout: true };
}
