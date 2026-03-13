import { storage } from "../storage";
import type { User } from "@shared/schema";

/**
 * Builds the full combat-ready team stats object for a player.
 * All 6 DB calls are parallelized with Promise.all instead of sequential awaits.
 */
export async function getPlayerTeamStats(userId: string) {
  // OPTIMIZATION: fetch all data in parallel (was 6 sequential awaits before)
  const [user, comps, equips, allPets, allHorses, allTransforms] = await Promise.all([
    storage.getUser(userId),
    storage.getCompanions(userId),
    storage.getEquipment(userId),
    storage.getPets(userId),
    storage.getHorses(userId),
    storage.getTransformations(userId),
  ]);

  if (!user) return null;

  const partyCompanions = comps.filter(c => c.isInParty);
  const activePet       = allPets.find(p => p.isActive);
  const activeHorse     = allHorses.find(h => h.isActive);

  const playerEquipped  = equips.filter(e => e.isEquipped && e.equippedToType === 'player');
  const weapon          = playerEquipped.find(e => e.type === 'Weapon');
  const weaponType      = (weapon as any)?.weaponType;

  // Check for active transformation
  let activeTransform = null;
  if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
    activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
  }

  const totalAtkBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.attackBonus  * (1 + (e.level - 1) * 0.05)), 0);
  const totalDefBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
  const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus   * (1 + (e.level - 1) * 0.10)), 0);
  const totalHpBonus  = playerEquipped.reduce((s, e) => s + Math.floor((e.hpBonus || 0) * (1 + (e.level - 1) * 0.10)), 0);

  const STR    = (user as any).str || 1;
  const AGI    = (user as any).agi || 1;
  const VIT    = (user as any).vit || 1;
  const INT    = (user as any).int || 1;
  const DEX    = (user as any).dex || 1;
  const LUK    = (user as any).luk || 1;
  const BaseLv = user.level;

  const statusMATK  = Math.floor(1.5 * INT) + Math.floor(DEX / 5) + Math.floor(LUK / 3);
  const softMDEF    = INT + Math.floor(VIT / 5) + Math.floor(DEX / 5);
  const hit         = 175 + BaseLv + DEX + Math.floor(LUK / 3);
  const fleeA       = 100 + BaseLv + AGI + Math.floor(LUK / 5);
  const perfectDodge = Math.floor(LUK / 10);
  const flee        = fleeA + perfectDodge;
  const critRate    = 0.3 * LUK;

  const isRanged = (wt?: string | null) =>
    wt === 'bow' || wt === 'gun' || wt === 'instrument' || wt === 'whip';

  const statusAtk = isRanged(weaponType)
    ? Math.floor(BaseLv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3)
    : Math.floor(BaseLv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);

  const baseWeaponAtk  = totalAtkBonus + (user.permAttackBonus || 0);
  const finalWeaponAtk = isRanged(weaponType)
    ? Math.floor(baseWeaponAtk * (1 + 0.005 * DEX))
    : Math.floor(baseWeaponAtk * (1 + 0.005 * STR));

  let attack  = statusAtk + finalWeaponAtk;
  let defense = (user.defense || 0) + totalDefBonus + (user.permDefenseBonus || 0);
  let speed   = (user.speed   || 0) + totalSpdBonus + (user.permSpeedBonus  || 0) + Math.floor(AGI / 2);
  let maxHp   = Math.floor(((user.maxHp || 100) + (user.permHpBonus || 0)) * (1 + 0.01 * VIT)) + totalHpBonus;
  let hp      = Math.min((user.hp || 100) + (user.permHpBonus || 0) + totalHpBonus, maxHp);
  const maxSp = Math.floor(100 * (1 + 0.01 * INT));

  if (activeTransform) {
    attack  = Math.floor(attack  * (1 + activeTransform.attackPercent  / 100));
    defense = Math.floor(defense * (1 + activeTransform.defensePercent / 100));
    speed   = Math.floor(speed   * (1 + activeTransform.speedPercent   / 100));
    const hpBonus = Math.floor(maxHp * (activeTransform.hpPercent / 100));
    maxHp += hpBonus;
    hp    += hpBonus;
  }

  // OPTIMIZATION: pre-group equipment by companion ID to avoid O(n*m) in the companion map loop
  const equipByCompanionId = new Map<number, typeof equips>();
  for (const e of equips) {
    if (e.isEquipped && e.equippedToType === 'companion' && e.equippedToId != null) {
      const key = Number(e.equippedToId);
      if (!equipByCompanionId.has(key)) equipByCompanionId.set(key, []);
      equipByCompanionId.get(key)!.push(e);
    }
  }

  const stats = {
    player: {
      name: user.firstName || user.lastName || 'Warrior',
      level: user.level,
      hp,
      maxHp,
      attack,
      defense,
      speed,
      weaponType,
      str: STR, agi: AGI, vit: VIT, int: INT, dex: DEX, luk: LUK,
      strBonus: 0, agiBonus: 0, vitBonus: 0, intBonus: 0, dexBonus: 0, lukBonus: 0,
      statPoints: user.statPoints || 0,
      hit,
      flee,
      statusMATK,
      softMDEF,
      maxSp,
      critChance:       playerEquipped.reduce((s, e) => s + (e.critChance || 0), 0) + Math.floor(critRate),
      critDamage:       playerEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
      endowmentPoints:  playerEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
      equipped:         playerEquipped.map(e => ({ name: e.name, type: e.type, level: e.level })),
      canTransform:     allTransforms.length > 0,
      activeTransform:  activeTransform ? { name: activeTransform.name, until: user.transformActiveUntil } : null,
      seppukuCount:     user.seppukuCount || 0,
      permStats: {
        attack:  user.permAttackBonus  || 0,
        defense: user.permDefenseBonus || 0,
        speed:   user.permSpeedBonus   || 0,
        hp:      user.permHpBonus      || 0,
      },
    } as any,

    companions: partyCompanions.map(c => {
      const compEquipped = equipByCompanionId.get(Number(c.id)) ?? [];
      const cWeapon      = compEquipped.find(e => e.type === 'Weapon');
      const cWeaponType  = (cWeapon as any)?.weaponType;

      const cAtkBonus = compEquipped.reduce((s, e) => s + Math.floor(e.attackBonus  * (1 + (e.level - 1) * 0.05)), 0);
      const cDefBonus = compEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
      const cSpdBonus = compEquipped.reduce((s, e) => s + Math.floor(e.speedBonus   * (1 + (e.level - 1) * 0.10)), 0);

      const cSTR = (c as any).str || 10;
      const cVIT = (c as any).vit || 10;
      const cAGI = (c as any).agi || 10;
      const cDEX = (c as any).dex || 10;
      const cLUK = (c as any).luk || 1;
      const cLv  = c.level || 1;

      const cStatusAtk = isRanged(cWeaponType)
        ? Math.floor(cLv / 4) + Math.floor(cSTR / 5) + cDEX + Math.floor(cLUK / 3)
        : Math.floor(cLv / 4) + cSTR + Math.floor(cDEX / 5) + Math.floor(cLUK / 3);

      const cFinalWeaponAtk = isRanged(cWeaponType)
        ? Math.floor(cAtkBonus * (1 + 0.005 * cDEX))
        : Math.floor(cAtkBonus * (1 + 0.005 * cSTR));

      let cMaxHp   = Math.floor(c.maxHp * (1 + 0.01 * cVIT));
      let cHp      = Math.min(c.hp, cMaxHp);
      let cAttack  = cStatusAtk + cFinalWeaponAtk;
      let cDefense = c.defense + cDefBonus;
      let cSpeed   = c.speed + cSpdBonus;

      return {
        id: c.id, name: c.name, level: c.level,
        hp: cHp, maxHp: cMaxHp, attack: cAttack, defense: cDefense, speed: cSpeed,
        weaponType: cWeaponType,
        str: cSTR, agi: cAGI, vit: cVIT, int: (c as any).int || 10, dex: cDEX, luk: cLUK,
        critChance:      compEquipped.reduce((s, e) => s + (e.critChance || 0), 0) + Math.floor(cLUK * 0.3),
        critDamage:      compEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: compEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        skill:    c.skill,
        equipped: compEquipped.map(e => ({ name: e.name, type: e.type, level: e.level })),
      } as any;
    }),

    pet: activePet ? {
      name: activePet.name, level: activePet.level,
      hp: activePet.hp, maxHp: activePet.maxHp,
      attack: activePet.attack, defense: activePet.defense,
      speed: activePet.speed, skill: activePet.skill,
    } : null,

    horse: activeHorse ? {
      name: activeHorse.name, level: activeHorse.level,
      speedBonus:   activeHorse.speedBonus,
      attackBonus:  activeHorse.attackBonus,
      defenseBonus: activeHorse.defenseBonus || 0,
      skill:        activeHorse.skill,
    } : null,
  };

  // Apply pet bonuses to whole party
  if (activePet) {
    const party = [stats.player, ...stats.companions];
    for (const member of party) {
      member.attack  += activePet.attack;
      member.defense += activePet.defense;
      member.speed   += activePet.speed;
      member.maxHp   += activePet.hp;
      member.hp      += activePet.hp;
    }
  }

  // Apply horse bonuses to whole party
  if (activeHorse) {
    const party = [stats.player, ...stats.companions];
    for (const member of party) {
      if (activeHorse.speedBonus > 0)
        member.speed   = Math.floor(member.speed   * (1 + activeHorse.speedBonus   / 100));
      if (activeHorse.attackBonus > 0)
        member.attack  = Math.floor(member.attack  * (1 + activeHorse.attackBonus  / 100));
      if ((activeHorse.defenseBonus || 0) > 0)
        member.defense = Math.floor(member.defense * (1 + (activeHorse.defenseBonus || 0) / 100));
    }
  }

  return stats;
}
