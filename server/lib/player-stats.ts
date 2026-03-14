import { storage } from "../storage";

export async function giveEquipmentExp(userId: string, expAmount: number) {
  const allEquip = await storage.getEquipment(userId);
  const equipped = allEquip.filter(e => e.isEquipped);
  for (const eq of equipped) {
    const newExp      = (eq.experience || 0) + Math.floor(expAmount / 4);
    const newExpToNext = eq.expToNext || 100;
    if (newExp >= newExpToNext) {
      await storage.updateEquipment(eq.id, {
        level: (eq.level || 1) + 1,
        experience: newExp - newExpToNext,
        expToNext: Math.floor(newExpToNext * 1.5),
      });
    } else {
      await storage.updateEquipment(eq.id, { experience: newExp });
    }
  }
}

export async function getPlayerTeamStats(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const allEquipment  = await storage.getEquipment(userId);
  const allCompanions = await storage.getCompanions(userId);
  const allPets       = await storage.getPets(userId);
  const allHorses     = await storage.getHorses(userId);
  const allTransforms = await storage.getTransformations(userId);

  const activePet   = allPets.find(p => p.isActive);
  const activeHorse = allHorses.find(h => h.isActive);

  const playerEquipped = allEquipment.filter(e => e.isEquipped && e.equippedToType === "player");
  const totalDefBonus  = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.1)), 0);
  const totalSpdBonus  = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus   * (1 + (e.level - 1) * 0.1)), 0);
  const totalHpBonus   = playerEquipped.reduce((s, e) => s + Math.floor((e.hpBonus || 0) * (1 + (e.level - 1) * 0.1)), 0);
  const weapon         = playerEquipped.find(e => e.type === "Weapon");
  const weaponType     = (weapon as any)?.weaponType;

  let activeTransform: any = null;
  if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
    activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
  }

  const STR = (user as any).str  || 1;
  const AGI = (user as any).agi  || 1;
  const VIT = (user as any).vit  || 1;
  const INT = (user as any).int  || 1;
  const DEX = (user as any).dex  || 1;
  const LUK = (user as any).luk  || 1;
  const Lv  = user.level;

  const isRanged  = ["bow","gun","instrument","whip"].includes(weaponType);
  const statusAtk = isRanged
    ? Math.floor(Lv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3)
    : Math.floor(Lv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
  const weaponAtk = weapon ? Math.floor((weapon.attackBonus || 0) * (1 + (weapon.level - 1) * 0.1)) : 0;

  const softDEF  = Math.floor(VIT / 2) + Math.floor(AGI / 5);
  const hit      = 175 + Lv + DEX + Math.floor(LUK / 3);
  const flee     = 100 + Lv + AGI + Math.floor(LUK / 5) + Math.floor(LUK / 10);
  const critRate = 0.3 * LUK;

  let attack  = statusAtk + weaponAtk;
  let defense = (user.defense || 0) + totalDefBonus + (user.permDefenseBonus || 0);
  let speed   = (user.speed   || 0) + totalSpdBonus + (user.permSpeedBonus   || 0) + Math.floor(AGI / 2);
  let maxHp   = Math.floor(((user.maxHp || 100) + (user.permHpBonus || 0)) * (1 + 0.01 * VIT)) + totalHpBonus;
  let hp      = Math.min((user.hp || 100) + (user.permHpBonus || 0) + totalHpBonus, maxHp);

  if (activeTransform) {
    attack  = Math.floor(attack  * (1 + activeTransform.attackPercent  / 100));
    defense = Math.floor(defense * (1 + activeTransform.defensePercent / 100));
    speed   = Math.floor(speed   * (1 + activeTransform.speedPercent   / 100));
    const hpBoost = Math.floor(maxHp * activeTransform.hpPercent / 100);
    maxHp += hpBoost;
    hp    += hpBoost;
  }

  const stats: any = {
    player: {
      name: user.firstName || user.lastName || "Warrior",
      level: Lv, hp, maxHp, attack, defense, speed, weaponType,
      str: STR, agi: AGI, vit: VIT, int: INT, dex: DEX, luk: LUK,
      weaponATK: weaponAtk, weaponLevel: weapon?.level || 1,
      hardDEF: defense, softDEF, hit, flee,
      critChance: critRate, critDamage: 0, bonusATK: 0,
      sp: Math.floor(100 * (1 + 0.01 * INT)),
      maxSp: Math.floor(100 * (1 + 0.01 * INT)),
      permStats: {
        attack:  user.permAttackBonus  || 0,
        defense: user.permDefenseBonus || 0,
        speed:   user.permSpeedBonus   || 0,
        hp:      user.permHpBonus      || 0,
      },
    },
    companions: [] as any[],
  };

  for (const c of allCompanions.filter(c => c.isInParty)) {
    const cEquipped   = allEquipment.filter(e => e.isEquipped && e.equippedToType === "companion" && e.equippedToId === c.id);
    const cWeapon     = cEquipped.find(e => e.type === "Weapon");
    const cWeaponType = (cWeapon as any)?.weaponType;
    const cDefBonus   = cEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.1)), 0);
    const cSpdBonus   = cEquipped.reduce((s, e) => s + Math.floor(e.speedBonus   * (1 + (e.level - 1) * 0.1)), 0);
    const cHpBonus    = cEquipped.reduce((s, e) => s + Math.floor((e.hpBonus || 0) * (1 + (e.level - 1) * 0.1)), 0);

    const cSTR = (c as any).str || Math.floor(c.attack / 3) || 1;
    const cAGI = (c as any).agi || c.agi || 1;
    const cVIT = (c as any).vit || Math.floor(c.defense / 2) || 1;
    const cINT = (c as any).int || 1;
    const cDEX = (c as any).dex || c.dex || 1;
    const cLUK = (c as any).luk || 1;
    const cLv  = c.level || 1;

    const cIsRanged  = ["bow","gun","instrument","whip"].includes(cWeaponType);
    const cStatusAtk = cIsRanged
      ? Math.floor(cLv / 4) + Math.floor(cSTR / 5) + cDEX + Math.floor(cLUK / 3)
      : Math.floor(cLv / 4) + cSTR + Math.floor(cDEX / 5) + Math.floor(cLUK / 3);
    const cWeaponAtk = cWeapon ? Math.floor((cWeapon.attackBonus || 0) * (1 + (cWeapon.level - 1) * 0.1)) : 0;
    const cHardDEF   = (c.defense || 0) + cDefBonus;
    const cMaxHp     = Math.floor(((c.maxHp || 50) * (1 + 0.01 * cVIT))) + cHpBonus;

    stats.companions.push({
      id: c.id, name: c.name, level: cLv,
      hp:      Math.min((c.hp || 50) + cHpBonus, cMaxHp),
      maxHp:   cMaxHp,
      attack:  cStatusAtk + cWeaponAtk,
      defense: cHardDEF,
      speed:   (c.speed || 10) + cSpdBonus + Math.floor(cAGI / 2),
      weaponType: cWeaponType,
      str: cSTR, agi: cAGI, vit: cVIT, int: cINT, dex: cDEX, luk: cLUK,
      weaponATK: cWeaponAtk, weaponLevel: cWeapon?.level || 1,
      hardDEF: cHardDEF,
      softDEF: Math.floor(cVIT / 2) + Math.floor(cAGI / 5),
      hit:  175 + cLv + cDEX + Math.floor(cLUK / 3),
      flee: 100 + cLv + cAGI + Math.floor(cLUK / 5) + Math.floor(cLUK / 10),
      critChance: 0.3 * cLUK, critDamage: 0, bonusATK: 0,
      skills: c.skill ? [c.skill] : ["Attack"],
    });
  }

  if (activePet) {
    for (const member of [stats.player, ...stats.companions]) {
      member.attack  = Math.floor(member.attack  * (1 + (activePet.attack  || 5)  / 100));
      member.defense = Math.floor(member.defense * (1 + (activePet.defense || 5)  / 100));
      member.speed   = Math.floor(member.speed   * (1 + (activePet.speed   || 15) / 200));
    }
  }

  if (activeHorse) {
    for (const member of [stats.player, ...stats.companions]) {
      member.attack  += activeHorse.attackBonus  || 0;
      member.defense += activeHorse.defenseBonus || 0;
      member.speed   += activeHorse.speedBonus   || 10;
    }
  }

  return stats;
}
