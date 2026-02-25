import { EnemyStats, TeamStats } from "../client/src/hooks/use-game";

export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critDamage: number;
  isPlayer: boolean;
  stamina?: number;
  maxStamina?: number;
  statusEffects: { type: string; duration: number }[];
  isGuarding: boolean;
  endowmentPoints?: number;
}

export function calculateDamage(attacker: CombatUnit, defender: CombatUnit, isCritical: boolean = false) {
  let baseDamage = Number(attacker.attack) || 0;
  // Critical modifier: 1.5x base + critical damage from equipment
  let critMod = isCritical ? (1.5 + ((Number(attacker.critDamage) || 0) / 100)) : 1.0;
  
  // Endowment points provide 0.5% damage reduction per point, capped at 35% (70 points)
  const endowmentPoints = Number((defender as any).endowmentPoints) || 0;
  const damageReduction = Math.min(0.35, (endowmentPoints * 0.5) / 100);
  
  // Final Damage = Base Damage × (ATK / Enemy DEF) × Critical Modifier × (1 - Damage Reduction)
  const defenderDefense = Math.max(1, Number(defender.defense) || 1);
  const ratio = attacker.attack / defenderDefense;
  
  // Adjusted formula: 
  // If ATK >> DEF, damage scales with ATK
  // If ATK ~ DEF, damage is roughly ATK
  // If ATK << DEF, damage is significantly reduced
  let damage = Math.floor(attacker.attack * Math.sqrt(ratio) * critMod * (1 - damageReduction));
  
  if (defender.isGuarding) {
    damage = Math.floor(damage * 0.7);
  }
  
  return Math.max(1, damage);
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
      critChance: Number((playerTeam.player as any).critChance) || 0,
      critDamage: Number((playerTeam.player as any).critDamage) || 0,
      isPlayer: true,
      stamina: 100,
      maxStamina: 100,
      statusEffects: [],
      isGuarding: false,
      endowmentPoints: Number((playerTeam.player as any).endowmentPoints) || 0
    } as any);

    playerTeam.companions.forEach((c, i) => {
      units.push({
        id: `comp-${i}`,
        name: c.name,
        hp: Number(c.hp) || 0,
        maxHp: Number(c.maxHp) || 0,
        attack: Number(c.attack) || 0,
        defense: Number(c.defense) || 0,
        speed: Number(c.speed) || 0,
        critChance: Number((c as any).critChance) || 0,
        critDamage: Number((c as any).critDamage) || 0,
        isPlayer: true,
        statusEffects: [],
        isGuarding: false,
        endowmentPoints: Number((c as any).endowmentPoints) || 0
      } as any);
    });
  
  // Initialize enemies
  enemies.forEach((e, i) => {
    units.push({
      id: `enemy-${i}`,
      name: e.name,
      hp: Number(e.hp) || 0,
      maxHp: Number(e.maxHp) || 0,
      attack: Number(e.attack) || 0,
      defense: Number(e.defense) || 0,
      speed: Number(e.speed) || 0,
      isPlayer: false,
      statusEffects: [],
      isGuarding: false,
      critChance: 0,
      critDamage: 0
    });
  });

  let turn = 0;
  const maxTurns = 20;
  
  while (turn < maxTurns) {
    turn++;
    logs.push(`--- TURN ${turn} ---`);
    
    // Initiative Phase: Sort by speed
    units.sort((a, b) => b.speed - a.speed);
    
    for (const unit of units) {
      if (unit.hp <= 0) continue;

      // Check if any enemies are still alive before this unit takes its turn
      const enemyAlive = units.filter(u => !u.isPlayer && u.hp > 0).length > 0;
      const playerAlive = units.filter(u => u.isPlayer && u.hp > 0).length > 0;
      if (!enemyAlive || !playerAlive) break;
      
      // Check for Stun
      const stun = unit.statusEffects.find(s => s.type === 'Stun');
      if (stun) {
        logs.push(`${unit.name} is stunned and skips turn!`);
        unit.statusEffects = unit.statusEffects.filter(s => s.type !== 'Stun');
        continue;
      }
      
      // Resolution Phase: Apply DOTs
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

      // Simple AI for everyone for now (simulating turn flow)
      const targets = units.filter(u => u.isPlayer !== unit.isPlayer && u.hp > 0);
      if (targets.length === 0) break;
      
      const target = targets[Math.floor(Math.random() * targets.length)];
      
      // Critical chance: 5% base + critChance from equipment
      const critChance = (unit.critChance || 0) + 5;
      const isCrit = (Math.random() * 100) < critChance;
      const damage = calculateDamage(unit, target, isCrit);
      
      target.hp -= damage;
      logs.push(`${unit.name} attacks ${target.name} for ${damage}${isCrit ? ' (CRITICAL!)' : ''} damage.`);
      
      // Status Proc simulation
      if (unit.name.includes("Ninja") && Math.random() < 0.3) {
        target.statusEffects.push({ type: 'Stun', duration: 1 });
        logs.push(`${target.name} was stunned by the strike!`);
      }
      
      if (target.hp <= 0) {
        logs.push(`${target.name} has been KO'd!`);
      }
      
      // Reset guard
      unit.isGuarding = false;
    }
    
    // Check Victory/Defeat
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
