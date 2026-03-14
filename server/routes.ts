import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { api, buildUrl } from "@shared/routes";
import { runTurnBasedCombat } from "./combat";

// ─── Name pools ────────────────────────────────────────────────────────────
const JP_ENEMY_NAMES = ["Ashigaru","Ronin","Bandit","Mercenary","Scout","Raider","Footsoldier","Brigand"];
const CN_ENEMY_NAMES = ["Soldier","Conscript","Raider","Bandit","Scout","Mercenary","Rebel","Warlord's Guard"];
const JP_BOSS_NAMES = ["Warlord","Demon General","Shadow Daimyo","Blood Oni","Iron Samurai","Thunder Lord"];
const CN_BOSS_NAMES = ["Dragon General","Iron Warlord","Shadow Emperor","Thunder Khan","Fire Lord","Celestial Warrior"];

const SPECIAL_BOSSES = [
  { name: "Oda Nobunaga's Ghost",    skill: "Demon King's Wrath" },
  { name: "Toyotomi Hideyoshi",      skill: "Monkey King's Cunning" },
  { name: "Tokugawa Ieyasu",         skill: "Tanuki's Patience" },
  { name: "Uesugi Kenshin",          skill: "War God's Blessing" },
  { name: "Takeda Shingen",          skill: "Mountain Fortress" },
  { name: "Date Masamune",           skill: "One-Eyed Dragon" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Equipment generation ───────────────────────────────────────────────────
const WEAPON_NAMES: Record<string, string[]> = {
  sword:      ["Katana","Nodachi","Wakizashi","Tachi","Odachi"],
  spear:      ["Yari","Naginata","Bisento","Jumonji Yari"],
  bow:        ["Yumi","Daikyu","Hankyu","War Bow"],
  staff:      ["Shakujo","Bo Staff","Mystic Rod","Spirit Wand"],
  dagger:     ["Tanto","Kunai","Shuriken Blade","Shadow Edge"],
  gun:        ["Tanegashima","Arquebuse","Fire Serpent"],
  instrument: ["War Drum","Battle Flute","Spirit Shamisen"],
  whip:       ["Iron Chain","Dragon Whip","Thunder Lash"],
};

const ARMOR_NAMES  = ["Do Maru","Haramaki","Tosei Gusoku","Okegawa Do","Lamellar Armor","Scale Armor"];
const SHIELD_NAMES = ["Tate","Round Shield","Iron Buckler","War Board"];
const HELMET_NAMES = ["Kabuto","Jingasa","Iron Helm","Spirit Mask","Demon Kabuto"];
const ACC_NAMES    = ["Magatama","War Fan","Prayer Beads","Jade Pendant","Spirit Talisman"];

const RARITY_ORDER = ["white","green","blue","purple","orange","red","gold","exotic","transcendent","celestial"];

function generateEquipment(userId: string, locationId: number = 1, isBoss: boolean = false) {
  const rarity = equipRarityFromRandom(locationId);
  const types = ["Weapon","Armor","Shield","HeadgearUpper","Accessory","Garment","Footgear"];
  const type  = isBoss ? pick(["Weapon","Armor"]) : pick(types);
  let name: string;
  if (type === "Weapon") {
    const wt = pick(Object.keys(WEAPON_NAMES));
    name = pick(WEAPON_NAMES[wt]);
  } else if (type === "Armor")        name = pick(ARMOR_NAMES);
  else if (type === "Shield")         name = pick(SHIELD_NAMES);
  else if (type === "HeadgearUpper")  name = pick(HELMET_NAMES);
  else                                name = pick(ACC_NAMES);
  const ri = RARITY_ORDER.indexOf(rarity);
  const mult = 1 + ri * 0.5 + (locationId - 1) * 0.1;
  return {
    userId, name, type, rarity,
    attackBonus:  type === "Weapon" ? Math.floor((10 + Math.random() * 20) * mult) : 0,
    defenseBonus: ["Armor","Shield","Garment","Footgear"].includes(type)
                    ? Math.floor((5 + Math.random() * 10) * mult) : 0,
    speedBonus:   type === "Footgear" ? Math.floor((2 + Math.random() * 5) * mult) : 0,
    hpBonus:      type === "Armor"    ? Math.floor((10 + Math.random() * 20) * mult) : 0,
    level: 1, isEquipped: false,
    cardSlots: ri >= 5 ? 1 : 0,
  };
}

function equipRarityFromRandom(locationId: number = 1): string {
  const r = Math.random();
  const isChina = locationId >= 100;
  if (isChina) {
    const chinaIndex = locationId - 100;
    const bonus = chinaIndex * 0.02;
    if (r > 0.985 - bonus) return 'celestial';
    if (r > 0.965 - bonus) return 'transcendent';
    if (r > 0.92  - bonus) return 'exotic';
    if (r > 0.85  - bonus) return 'gold';
    if (r > 0.75  - bonus) return 'red';
    if (r > 0.60  - bonus) return 'orange';
    if (r > 0.40  - bonus) return 'purple';
    if (r > 0.20  - bonus) return 'blue';
    if (r > 0.10  - bonus) return 'green';
    return 'white';
  }
  const japanBonus = (locationId - 1) * 0.03;
  if (r > 0.995 - japanBonus/5) return 'celestial';
  if (r > 0.985 - japanBonus/2) return 'transcendent';
  if (r > 0.97  - japanBonus)   return 'exotic';
  if (r > 0.95  - japanBonus)   return 'gold';
  if (r > 0.90  - japanBonus)   return 'red';
  if (r > 0.82  - japanBonus)   return 'orange';
  if (r > 0.70  - japanBonus)   return 'purple';
  if (r > 0.50  - japanBonus)   return 'blue';
  if (r > 0.25  - japanBonus)   return 'green';
  return 'white';
}

async function giveEquipmentExp(userId: string, expAmount: number) {
  const allEquip = await storage.getEquipment(userId);
  const equipped = allEquip.filter(e => e.isEquipped);
  for (const eq of equipped) {
    const newExp = (eq.experience || 0) + Math.floor(expAmount / 4);
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

async function getPlayerTeamStats(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  const allEquipment   = await storage.getEquipment(userId);
  const allCompanions  = await storage.getCompanions(userId);
  const allPets        = await storage.getPets(userId);
  const allHorses      = await storage.getHorses(userId);
  const allTransforms  = await storage.getTransformations(userId);

  const activePet   = allPets.find(p => p.isActive);
  const activeHorse = allHorses.find(h => h.isActive);

  if (user) {
    const playerEquipped = allEquipment.filter(e => e.isEquipped && e.equippedToType === 'player');
    const totalDefBonus  = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.1)), 0);
    const weapon         = playerEquipped.find(e => e.type === 'Weapon');
    const weaponType     = (weapon as any)?.weaponType;

    let activeTransform = null;
    if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
      activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
    }

    const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
    const totalHpBonus  = playerEquipped.reduce((s, e) => s + Math.floor((e.hpBonus || 0) * (1 + (e.level - 1) * 0.1)), 0);

    const STR    = (user as any).str || 1;
    const AGI    = (user as any).agi || 1;
    const VIT    = (user as any).vit || 1;
    const INT    = (user as any).int || 1;
    const DEX    = (user as any).dex || 1;
    const LUK    = (user as any).luk || 1;
    const BaseLv = user.level;

    const statusATK  = STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
    const statusMATK = Math.floor(1.5 * INT) + Math.floor(DEX / 5) + Math.floor(LUK / 3);
    const softDEF    = Math.floor(VIT / 2) + Math.floor(AGI / 5);
    const softMDEF   = INT + Math.floor(VIT / 5) + Math.floor(DEX / 5);
    const hit        = 175 + BaseLv + DEX + Math.floor(LUK / 3);
    const fleeA      = 100 + BaseLv + AGI + Math.floor(LUK / 5);
    const perfectDodge = Math.floor(LUK / 10);
    const flee       = fleeA + perfectDodge;
    const critRate   = 0.3 * LUK;

    const statusAtk = (weaponType === 'bow' || weaponType === 'gun' || weaponType === 'instrument' || weaponType === 'whip')
      ? Math.floor(BaseLv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3)
      : Math.floor(BaseLv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);

    const weaponAtk = weapon ? Math.floor((weapon.attackBonus || 0) * (1 + (weapon.level - 1) * 0.1)) : 0;
    const finalWeaponAtk = weaponAtk;

    let attack  = statusAtk + finalWeaponAtk;
    let defense = (user.defense || 0) + totalDefBonus + (user.permDefenseBonus || 0);
    let speed   = (user.speed || 0) + totalSpdBonus + (user.permSpeedBonus || 0) + Math.floor(AGI / 2);
    let maxHp   = Math.floor(((user.maxHp || 100) + (user.permHpBonus || 0)) * (1 + 0.01 * VIT)) + totalHpBonus;
    let hp      = Math.min((user.hp || 100) + (user.permHpBonus || 0) + totalHpBonus, maxHp);
    const maxSp = Math.floor(100 * (1 + 0.01 * INT));

    if (activeTransform) {
      attack  = Math.floor(attack  * (1 + activeTransform.attackPercent  / 100));
      defense = Math.floor(defense * (1 + activeTransform.defensePercent / 100));
      speed   = Math.floor(speed   * (1 + activeTransform.speedPercent   / 100));
      const hpBonus = Math.floor(maxHp * activeTransform.hpPercent / 100);
      maxHp += hpBonus;
      hp    += hpBonus;
    }

    const stats = {
      player: {
        name: user.firstName || user.lastName || 'Warrior',
        level: user.level,
        hp, maxHp, attack, defense, speed, weaponType,
        str: STR, agi: AGI, vit: VIT, int: INT, dex: DEX, luk: LUK,
        weaponATK: finalWeaponAtk, weaponLevel: weapon?.level || 1,
        hardDEF: defense, softDEF,
        hit, flee, critChance: critRate,
        sp: maxSp, maxSp,
        permStats: {
          attack: user.permAttackBonus || 0,
          defense: user.permDefenseBonus || 0,
          speed: user.permSpeedBonus || 0,
          hp: user.permHpBonus || 0,
        },
        statusATK, statusMATK, softMDEF,
        speed: speed,
      },
      companions: [] as any[],
    };

    for (const c of allCompanions.filter(c => c.isInParty)) {
      const cEquipped    = allEquipment.filter(e => e.isEquipped && e.equippedToType === 'companion' && e.equippedToId === c.id);
      const cWeapon      = cEquipped.find(e => e.type === 'Weapon');
      const cWeaponType  = (cWeapon as any)?.weaponType;
      const cDefBonus    = cEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.1)), 0);
      const cSpdBonus    = cEquipped.reduce((s, e) => s + Math.floor(e.speedBonus   * (1 + (e.level - 1) * 0.1)), 0);
      const cHpBonus     = cEquipped.reduce((s, e) => s + Math.floor((e.hpBonus || 0) * (1 + (e.level - 1) * 0.1)), 0);

      const cSTR = (c as any).str || Math.floor(c.attack / 3)  || 1;
      const cAGI = (c as any).agi || c.agi || 1;
      const cVIT = (c as any).vit || Math.floor(c.defense / 2) || 1;
      const cINT = (c as any).int || 1;
      const cDEX = (c as any).dex || c.dex || 1;
      const cLUK = (c as any).luk || 1;
      const cLv  = c.level || 1;

      const cStatusAtk = (cWeaponType === 'bow' || cWeaponType === 'gun' || cWeaponType === 'instrument' || cWeaponType === 'whip')
        ? Math.floor(cLv / 4) + Math.floor(cSTR / 5) + cDEX + Math.floor(cLUK / 3)
        : Math.floor(cLv / 4) + cSTR + Math.floor(cDEX / 5) + Math.floor(cLUK / 3);
      const cWeaponAtk    = cWeapon ? Math.floor((cWeapon.attackBonus || 0) * (1 + (cWeapon.level - 1) * 0.1)) : 0;
      const cFinalAtk     = cStatusAtk + cWeaponAtk;
      const cSoftDEF      = Math.floor(cVIT / 2) + Math.floor(cAGI / 5);
      const cHardDEF      = (c.defense || 0) + cDefBonus;
      const cMaxHp        = Math.floor(((c.maxHp || 50) * (1 + 0.01 * cVIT))) + cHpBonus;
      const cHp           = Math.min((c.hp || 50) + cHpBonus, cMaxHp);
      const cHit          = 175 + cLv + cDEX + Math.floor(cLUK / 3);
      const cFleeA        = 100 + cLv + cAGI + Math.floor(cLUK / 5);
      const cFlee         = cFleeA + Math.floor(cLUK / 10);
      const cSpeed        = (c.speed || 10) + cSpdBonus + Math.floor(cAGI / 2);

      stats.companions.push({
        id: c.id, name: c.name, level: cLv,
        hp: cHp, maxHp: cMaxHp,
        attack: cFinalAtk, defense: cHardDEF, speed: cSpeed,
        weaponType: cWeaponType,
        str: cSTR, agi: cAGI, vit: cVIT, int: cINT, dex: cDEX, luk: cLUK,
        weaponATK: cWeaponAtk, weaponLevel: cWeapon?.level || 1,
        hardDEF: cHardDEF, softDEF: cSoftDEF,
        hit: cHit, flee: cFlee, critChance: 0.3 * cLUK,
        skills: c.skill ? [c.skill] : ["Attack"],
      });
    }

    if (activePet) {
      const party = [stats.player, ...stats.companions];
      party.forEach(member => {
        member.attack  = Math.floor(member.attack  * (1 + (activePet.attack  || 5)  / 100));
        member.defense = Math.floor(member.defense * (1 + (activePet.defense || 5)  / 100));
        member.speed   = Math.floor(member.speed   * (1 + (activePet.speed   || 15) / 200));
      });
    }

    if (activeHorse) {
      const party = [stats.player, ...stats.companions];
      party.forEach(member => {
        member.attack  += activeHorse.attackBonus  || 0;
        member.defense += activeHorse.defenseBonus || 0;
        member.speed   += activeHorse.speedBonus   || 10;
      });
    }

    return stats;
  }
  return null;
}

function generateEnemyStats(type: 'field' | 'boss' | 'special', playerLevel: number, locationId: number = 1) {
  let targetLevel = 1;
  if (locationId >= 100) {
    targetLevel = 7 + (locationId - 101);
  } else {
    targetLevel = locationId;
  }
  const locationMultiplier = 1 + (targetLevel - 1) * 0.1;

  const makeBaseStats = (lvl: number) => ({
    str: Math.floor(lvl * 1.5),
    agi: Math.floor(lvl * 1.2),
    vit: Math.floor(lvl * 1.3),
    int: Math.floor(lvl * 0.8),
    dex: Math.floor(lvl * 1.4),
    luk: Math.max(1, Math.floor(lvl * 0.5)),
  });

  if (type === 'field') {
    const name     = locationId >= 100 ? pick(CN_ENEMY_NAMES) : pick(JP_ENEMY_NAMES);
    const lvl      = targetLevel;
    const baseHp   = lvl * 50 + 100;
    const baseAtk  = lvl * 10 + 20;
    const baseDef  = lvl * 8  + 15;
    const baseSpd  = lvl * 5  + 10;
    const stats    = makeBaseStats(lvl);
    const hardDEF  = Math.floor(baseDef  * locationMultiplier);
    const weaponATK = Math.floor(baseAtk * locationMultiplier);
    const weaponLevel = 1;
    const hit   = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const fleeA = 100 + lvl + stats.agi + Math.floor(stats.luk / 5);
    const flee  = fleeA + Math.floor(stats.luk / 10);
    return {
      name, level: lvl,
      hp: Math.floor(baseHp * locationMultiplier),
      maxHp: Math.floor(baseHp * locationMultiplier),
      attack: weaponATK, defense: hardDEF, speed: Math.floor(baseSpd * locationMultiplier),
      weaponType: 'none', ...stats, weaponATK, weaponLevel, hardDEF, softDEF: 0,
      hit, flee, skills: ["Scratch", "Bite"],
    };
  } else if (type === 'boss') {
    const name    = locationId >= 100 ? pick(CN_BOSS_NAMES) : pick(JP_BOSS_NAMES);
    const lvl     = targetLevel + 2;
    const baseHp  = lvl * 200 + 1000;
    const baseAtk = lvl * 30  + 100;
    const baseDef = lvl * 25  + 80;
    const baseSpd = lvl * 15  + 50;
    const stats   = makeBaseStats(lvl);
    stats.vit = Math.floor(stats.vit * 1.3);
    stats.agi = Math.floor(stats.agi * 1.2);
    const hardDEF   = Math.floor(baseDef  * locationMultiplier);
    const weaponATK = Math.floor(baseAtk  * locationMultiplier);
    const weaponLevel = 2;
    const hit   = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const fleeA = 100 + lvl + stats.agi + Math.floor(stats.luk / 5);
    const flee  = fleeA + Math.floor(stats.luk / 10);
    return {
      name, level: lvl,
      hp: Math.floor(baseHp * locationMultiplier),
      maxHp: Math.floor(baseHp * locationMultiplier),
      attack: weaponATK, defense: hardDEF, speed: Math.floor(baseSpd * locationMultiplier),
      weaponType: 'none', ...stats, weaponATK, weaponLevel, hardDEF, softDEF: 0,
      hit, flee, skills: ["War Cry", "Shield Wall", "Charge", "Strategic Strike"],
    };
  } else {
    const sb   = pick(SPECIAL_BOSSES);
    const name = locationId >= 100 ? "Celestial Dragon Emperor" : sb.name;
    const lvl  = targetLevel + 5;
    const baseHp  = lvl * 500 + 3000;
    const baseAtk = lvl * 50  + 200;
    const baseDef = lvl * 40  + 150;
    const baseSpd = lvl * 30  + 100;
    const stats   = makeBaseStats(lvl);
    stats.vit = Math.floor(stats.vit * 1.6);
    stats.agi = Math.floor(stats.agi * 1.3);
    stats.dex = Math.floor(stats.dex * 1.2);
    const hardDEF   = Math.floor(baseDef  * locationMultiplier);
    const weaponATK = Math.floor(baseAtk  * locationMultiplier);
    const weaponLevel = 3;
    const hit   = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const fleeA = 100 + lvl + stats.agi + Math.floor(stats.luk / 5);
    const flee  = fleeA + Math.floor(stats.luk / 10);
    return {
      name, level: lvl,
      hp: Math.floor(baseHp * locationMultiplier),
      maxHp: Math.floor(baseHp * locationMultiplier),
      attack: weaponATK, defense: hardDEF, speed: Math.floor(baseSpd * locationMultiplier),
      weaponType: 'none', ...stats, weaponATK, weaponLevel, hardDEF, softDEF: 0,
      hit, flee, skills: [sb.skill, "Roar", "Dark Aura", "Divine Intervention"],
    };
  }
}

export async function registerRoutes(
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ── Onboarding endpoints ──────────────────────────────────────────────────

  /**
   * POST /api/player/mark-intro-seen
   * Called by IntroOverlay once the player dismisses the title card.
   * Sets hasSeenIntro = true so the overlay never appears again.
   */
  app.post("/api/player/mark-intro-seen", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      await storage.updateUser(userId, { hasSeenIntro: true });
      res.json({ ok: true });
    } catch (err) {
      console.error("[mark-intro-seen]", err);
      res.status(500).json({ message: String(err) });
    }
  });

  // ── Player ────────────────────────────────────────────────────────────────
  app.get("/api/player", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "Player not found" });
    res.json(user);
  });

  app.get("/api/player/full-status", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(404).json({ message: "Player not found" });
    res.json(teamStats);
  });

  app.post("/api/restart", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    await storage.createEquipment({
      userId,
      name: "Training Sword",
      type: "Weapon",
      weaponType: "sword",
      rarity: "white",
      level: 1,
      attackBonus: 10,
      isEquipped: true,
    });
    res.json({ success: true });
  });

  // ── Companions ────────────────────────────────────────────────────────────
  app.get("/api/companions", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const companions = await storage.getCompanions(userId);
    res.json(companions);
  });

  app.post("/api/party", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { companionIds } = req.body;
    if (!Array.isArray(companionIds)) return res.status(400).json({ message: "companionIds must be an array" });
    if (companionIds.length > 3) return res.status(400).json({ message: "Maximum 3 companions in party" });
    const allComps = await storage.getCompanions(userId);
    const selectedComps = allComps.filter(c => companionIds.includes(c.id));
    const names = selectedComps.map(c => c.name);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) return res.status(400).json({ message: "Duplicate companion names not allowed" });
    await storage.updateParty(userId, companionIds);
    res.json({ success: true });
  });

  // ── Equipment ─────────────────────────────────────────────────────────────
  app.get("/api/equipment", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipment = await storage.getEquipment(userId);
    res.json(equipment);
  });

  app.post("/api/equipment/:id/equip", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { targetType, targetId } = req.body;
    const allEquip = await storage.getEquipment(userId);
    const item = allEquip.find(e => e.id === equipId);
    if (!item) return res.status(404).json({ message: "Equipment not found" });
    const sameSlotEquipped = allEquip.find(e =>
      e.isEquipped && e.type === item.type &&
      e.equippedToType === (targetType || 'player') &&
      e.equippedToId === (targetId || null) && e.id !== equipId
    );
    if (sameSlotEquipped) {
      await storage.updateEquipment(sameSlotEquipped.id, { isEquipped: false, equippedToType: null, equippedToId: null });
    }
    await storage.updateEquipment(equipId, { isEquipped: true, equippedToType: targetType || 'player', equippedToId: targetId || null });
    res.json({ success: true });
  });

  app.post("/api/equipment/:id/unequip", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const allEquip = await storage.getEquipment(userId);
    const item = allEquip.find(e => e.id === equipId);
    if (!item) return res.status(404).json({ message: "Equipment not found" });
    await storage.updateEquipment(equipId, { isEquipped: false, equippedToType: null, equippedToId: null });
    res.json({ success: true });
  });

  app.post("/api/equipment/recycle", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const { equipmentIds } = req.body;
    if (!Array.isArray(equipmentIds) || equipmentIds.length === 0)
      return res.status(400).json({ message: "equipmentIds required" });
    let stonesGained = 0;
    for (const id of equipmentIds) {
      const allEquip = await storage.getEquipment(userId);
      const targetEquip = allEquip.find(e => e.id === Number(id));
      if (!targetEquip || targetEquip.userId !== userId) continue;
      if (targetEquip.isEquipped) continue;
      stonesGained += 5;
      const user = await storage.getUser(userId);
      if (!user) continue;
      await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + 5 });
      await storage.deleteEquipment(Number(id));
    }
    res.json({ success: true, stonesGained });
  });

  app.post("/api/equipment/recycle-rarity", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await storage.recycleEquipment(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/equipment/:id/insert-card", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { cardId } = req.body;
    try {
      await storage.insertCardIntoEquipment(cardId, equipId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/cards", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const cards = await storage.getCards(userId);
    res.json(cards);
  });

  // ── Stats upgrade ─────────────────────────────────────────────────────────
  app.post("/api/stats/upgrade", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { stat } = req.body;
    const validStats = ['str','agi','vit','int','dex','luk'];
    if (!validStats.includes(stat)) return res.status(400).json({ message: "Invalid stat" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const currentVal = (user as any)[stat] || 1;
    if (currentVal >= 99) return res.status(400).json({ message: "Stat already at maximum" });
    const cost = Math.floor(2 + currentVal * 0.5);
    if (user.statPoints < cost) return res.status(400).json({ message: "Not enough stat points" });
    await storage.updateUser(userId, {
      [stat]: currentVal + 1,
      statPoints: user.statPoints - cost,
    });
    res.json({ success: true, newValue: currentVal + 1, pointsUsed: cost });
  });

  app.post("/api/stats/bulk-upgrade", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const { upgrades } = req.body;
    const validStats = ['str','agi','vit','int','dex','luk'];
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    let totalCost = 0;
    const updates: any = {};
    for (const [stat, amount] of Object.entries(upgrades as Record<string, number>)) {
      if (!validStats.includes(stat)) return res.status(400).json({ message: `Invalid stat: ${stat}` });
      let val = (user as any)[stat] || 1;
      let cost = 0;
      for (let i = 0; i < amount; i++) { cost += Math.floor(2 + (val + i) * 0.5); }
      if (val + amount > 99) return res.status(400).json({ message: `${stat} would exceed max` });
      totalCost += cost;
      updates[stat] = val + amount;
    }
    if (user.statPoints < totalCost) return res.status(400).json({ message: "Not enough stat points" });
    updates.statPoints = user.statPoints - totalCost;
    await storage.updateUser(userId, updates);
    res.json({ success: true, pointsUsed: totalCost });
  });

  // ── Pets ──────────────────────────────────────────────────────────────────
  app.get("/api/pets", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const pets = await storage.getPets(userId);
    res.json(pets);
  });

  app.post("/api/pets/:id/activate", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId  = Number(req.params.id);
    const pets   = await storage.getPets(userId);
    for (const p of pets) { await storage.updatePet(p.id, { isActive: false }); }
    await storage.updatePet(petId, { isActive: true });
    res.json({ success: true });
  });

  app.post("/api/pets/:id/deactivate", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId  = Number(req.params.id);
    await storage.updatePet(petId, { isActive: false });
    res.json({ success: true });
  });

  app.post("/api/pets/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId       = req.user.claims.sub;
    const petId        = Number(req.params.id);
    const { upgradeAmount } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const totalCost = upgradeAmount;
    if ((user.petEssence || 0) < totalCost) return res.status(400).json({ message: "Not enough pet essence" });
    const allPets = await storage.getPets(userId);
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    const newLevel  = (pet.level  || 1) + upgradeAmount;
    const newAttack = (pet.attack || 5) + upgradeAmount * 2;
    const newDef    = (pet.defense|| 5) + upgradeAmount;
    const newSpeed  = (pet.speed  ||15) + upgradeAmount;
    await storage.updatePet(petId, { level: newLevel, attack: newAttack, defense: newDef, speed: newSpeed });
    await storage.updateUser(userId, { petEssence: user.petEssence - totalCost });
    res.json({ success: true, newLevel });
  });

  // ── Horses ────────────────────────────────────────────────────────────────
  app.get("/api/horses", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const horses = await storage.getHorses(userId);
    res.json(horses);
  });

  app.post("/api/horses/:id/activate", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const horseId = Number(req.params.id);
    const horses  = await storage.getHorses(userId);
    for (const h of horses) { await storage.updateHorse(h.id, { isActive: false }); }
    await storage.updateHorse(horseId, { isActive: true });
    res.json({ success: true });
  });

  app.post("/api/horses/:id/deactivate", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const horseId = Number(req.params.id);
    await storage.updateHorse(horseId, { isActive: false });
    res.json({ success: true });
  });

  app.post("/api/horses/combine", isAuthenticated, async (req: any, res) => {
    const userId   = req.user.claims.sub;
    const { horseIds } = req.body;
    if (!Array.isArray(horseIds) || horseIds.length < 2)
      return res.status(400).json({ message: "Need at least 2 horses to combine" });
    const allHorses = await storage.getHorses(userId);
    const selected  = allHorses.filter(h => horseIds.includes(String(h.id)) || horseIds.includes(h.id));
    if (selected.length < 2) return res.status(400).json({ message: "Horses not found" });
    const baseHorse  = selected[0];
    const rarityOrder = ['white','green','blue','purple','orange','red','gold','exotic','transcendent','celestial'];
    const currentIndex = rarityOrder.indexOf(baseHorse.rarity);
    const upgraded     = Math.random() < 0.3;
    const newRarityIndex = upgraded && currentIndex < rarityOrder.length - 1 ? currentIndex + 1 : currentIndex;
    const newRarity = rarityOrder[newRarityIndex];
    for (const id of horseIds) { await storage.deleteHorse(Number(id)); }
    const newHorse = await storage.createHorse({
      userId, name: baseHorse.name, rarity: newRarity,
      speedBonus: baseHorse.speedBonus + (upgraded ? 5 : 2),
      attackBonus: baseHorse.attackBonus, defenseBonus: baseHorse.defenseBonus,
      skill: baseHorse.skill, isActive: false,
    });
    res.json({ success: true, upgraded, newHorse });
  });

  // ── Transformations ───────────────────────────────────────────────────────
  app.get("/api/transformations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const transforms = await storage.getTransformations(userId);
    res.json(transforms);
  });

  app.post("/api/transformations/:id/activate", isAuthenticated, async (req: any, res) => {
    const userId      = req.user.claims.sub;
    const transformId = Number(req.params.id);
    const transforms  = await storage.getTransformations(userId);
    const transform   = transforms.find(t => t.id === transformId);
    if (!transform) return res.status(404).json({ message: "Transformation not found" });
    const durationMs  = (transform.durationSeconds || 30) * 1000;
    const activeUntil = new Date(Date.now() + durationMs);
    await storage.updateUser(userId, { activeTransformId: transformId, transformActiveUntil: activeUntil });
    res.json({ success: true, activeUntil });
  });

  // ── Quests ────────────────────────────────────────────────────────────────
  app.get("/api/quests", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const quests = await storage.getQuests(userId);
    res.json(quests);
  });

  app.post("/api/quests/:key/claim", isAuthenticated, async (req: any, res) => {
    const userId   = req.user.claims.sub;
    const questKey = req.params.key;
    const result   = await storage.claimQuest(userId, questKey);
    res.json(result);
  });

  // ── Battle ────────────────────────────────────────────────────────────────
  app.post(api.battle.field.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId  = Number(req.body.locationId) || 1;
    const repeatCount = Number(req.body.repeatCount) || 1;
    const count = Math.min(Math.max(1, repeatCount), 10);
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    let totalExpGained  = 0;
    let totalGoldGained = 0;
    let totalRiceGained = 0;
    const allLogs: string[] = [];
    const allEquipDropped: any[] = [];
    let ninjaEncounter: any = null;
    let ninjaEncounteredInThisSkirmish = false;

    for (let i = 0; i < count; i++) {
      if (count > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);
      if (!ninjaEncounter && Math.random() < (locationId >= 100 ? 0.05 : 0.03)) {
        ninjaEncounteredInThisSkirmish = true;
        const ninjaNames = locationId >= 100
          ? ["Zhuge Liang (Ghost)", "Lu Bu's Spirit", "Empress Wu Zetian"]
          : ["Hattori Hanzo", "Fuma Kotaro", "Ishikawa Goemon", "Mochizuki Chiyome"];
        const ninjaName = pick(ninjaNames);
        const isSuperStrong = Math.random() < (locationId >= 100 ? 0.5 : 0.3);
        let targetLevel = 1;
        if (locationId >= 100) targetLevel = 7 + (locationId - 100);
        else targetLevel = locationId;
        const ninjaStats = {
          name: ninjaName,
          level: isSuperStrong ? targetLevel + 20 : targetLevel + 2,
          hp: isSuperStrong ? 5000 : 1000,
          maxHp: isSuperStrong ? 5000 : 1000,
          attack: isSuperStrong ? 500 : 100,
          defense: isSuperStrong ? 300 : 50,
          speed: isSuperStrong ? 200 : 80,
          weaponType: 'sword', str:20, agi:20, vit:20, int:10, dex:20, luk:10,
          weaponATK: isSuperStrong ? 500 : 100, weaponLevel:3, hardDEF:50, softDEF:0,
          hit:220, flee:150, skills:["Shadow Strike","Vanish"],
        };
        ninjaEncounter = ninjaStats;
        allLogs.push(`A famous ninja, ${ninjaName}, blocks your path!`);
        break;
      }
      const enemy = generateEnemyStats('field', user.level, locationId);
      if (i === 0 && req.body.enemyName) { enemy.name = req.body.enemyName; }
      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      allLogs.push(...(battleResult.log || []));
      const victory = battleResult.victory;
      if (victory) {
        await storage.updateQuestProgress(userId, 'daily_skirmish', 1);
        await storage.updateQuestProgress(userId, 'daily_skirmish_elite', 1);
        const expGained  = Math.floor(Math.random() * 50) + 30 + enemy.level * 5;
        const goldGained = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        totalExpGained  += expGained;
        totalGoldGained += goldGained;
        let currentExp   = user.experience + totalExpGained;
        let currentLevel = user.level;
        let currentMaxHp = user.maxHp;
        let currentStatPoints = user.statPoints;
        while (currentExp >= currentLevel * 100) {
          currentExp   -= currentLevel * 100;
          currentLevel += 1;
          currentMaxHp += 10;
          currentStatPoints += 3;
        }
        const userUpdate: any = {
          experience: currentExp, level: currentLevel, maxHp: currentMaxHp,
          statPoints: currentStatPoints,
          gold: user.gold + totalGoldGained,
        };
        await storage.updateUser(userId, userUpdate);
        if (Math.random() < 0.01) {
          const eqData = generateEquipment(userId, locationId);
          try {
            const eq = await storage.createEquipment(eqData);
            allEquipDropped.push(eq);
          } catch (err) {
            console.error("Failed to create equipment drop:", err);
          }
        }
      }
    }

    await giveEquipmentExp(userId, totalExpGained);
    res.json({
      victory: allLogs.some(l => l.includes("Victory")),
      logs: allLogs,
      expGained: totalExpGained,
      goldGained: totalGoldGained,
      equipmentDropped: allEquipDropped,
      ninjaEncounter,
    });
  });

  app.post(api.battle.ninja.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { ninjaStats } = req.body;
    if (!ninjaStats) return res.status(400).json({ message: "ninjaStats required" });
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    const battleResult = runTurnBasedCombat(teamStats, [ninjaStats]);
    if (battleResult.victory) {
      const expGained  = 100;
      const goldGained = 50;
      await storage.updateUser(userId, {
        experience: user.experience + expGained,
        gold: user.gold + goldGained,
        warriorSouls: (user.warriorSouls || 0) + 1,
      });
    }
    res.json({ victory: battleResult.victory, logs: battleResult.log || [] });
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { locationId: rawLocId, goldDemanded } = req.body;
    const locationId = Number(rawLocId) || 1;
    if (!goldDemanded) return res.status(400).json({ message: "goldDemanded required" });
    if (user.gold < goldDemanded) return res.status(400).json({ message: "Not enough gold" });
    await storage.updateUser(userId, { gold: user.gold - goldDemanded });
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    let targetLevel = 1;
    if (locationId >= 100) targetLevel = 7 + (locationId - 100);
    else targetLevel = locationId;
    const enemy = generateEnemyStats('boss', user.level, locationId);
    const logs: string[] = [];
    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    logs.push(...(battleResult.log || []));
    if (battleResult.victory) {
      const goldGained    = goldDemanded * 2;
      const stonesGained  = 3 + Math.floor(Math.random() * 3);
      await storage.updateUser(userId, {
        gold: user.gold - goldDemanded + goldGained,
        endowmentStones: (user.endowmentStones || 0) + stonesGained,
      });
    }
    res.json({ victory: battleResult.victory, logs, enemy });
  });

  app.post(api.battle.campaign.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const teamStats  = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    const enemy      = generateEnemyStats('boss', user.level, locationId);
    const logs: string[] = [];
    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    logs.push(...(battleResult.log || []));
    const victory = battleResult.victory;
    if (victory) {
      const expGained       = 100 + (locationId * 50);
      const goldGained      = 50  + (locationId * 25);
      const riceGained      = 10  + (locationId * 5);
      const endowmentStones = 2   + Math.floor(Math.random() * 3);
      let currentExp   = user.experience + expGained;
      let currentLevel = user.level;
      let currentMaxHp = user.maxHp;
      let currentStatPoints = user.statPoints;
      let currentSpd   = user.speed;
      while (currentExp >= currentLevel * 100) {
        currentExp   -= currentLevel * 100;
        currentLevel += 1;
        currentMaxHp += 10;
        currentStatPoints += 3;
        currentSpd   += 2;
      }
      await storage.updateUser(userId, {
        level: currentLevel, experience: currentExp,
        gold: user.gold + goldGained, rice: (user.rice || 0) + riceGained,
        maxHp: currentMaxHp, statPoints: currentStatPoints, speed: currentSpd,
        endowmentStones: (user.endowmentStones || 0) + endowmentStones,
        currentLocationId: Math.max(user.currentLocationId || 1, locationId),
      });
      if (Math.random() < 0.05) {
        const eqData = generateEquipment(userId, locationId, true);
        const eq = await storage.createEquipment(eqData);
        return res.json({
          victory, logs, expGained, goldGained, riceGained, equipmentDropped: [eq], petDropped: null, logs
        });
      }
      return res.json({
        victory, logs, expGained, goldGained, riceGained, equipmentDropped: [], petDropped: null, logs
      });
    }
    res.json({ victory: false, logs, expGained: 0, goldGained: 0, riceGained: 0, equipmentDropped: [], petDropped: null });
  });

  app.post(api.battle.special.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const teamStats  = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    const enemy      = generateEnemyStats('special', user.level, locationId);
    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    const victory = battleResult.victory;
    if (victory) {
      const expGained       = 250 + (locationId * 100);
      const goldGained      = 150 + (locationId * 75);
      const endowmentStones = 5   + Math.floor(Math.random() * 6);
      let currentExp   = user.experience + expGained;
      let currentLevel = user.level;
      let currentMaxHp = user.maxHp;
      let currentStatPoints = user.statPoints;
      let currentSpd   = user.speed;
      while (currentExp >= currentLevel * 100) {
        currentExp   -= currentLevel * 100;
        currentLevel += 1;
        currentMaxHp += 10;
        currentStatPoints += 3;
        currentSpd   += 2;
      }
      await storage.updateUser(userId, {
        level: currentLevel, experience: currentExp,
        maxHp: currentMaxHp, statPoints: currentStatPoints, speed: currentSpd,
        gold: user.gold + goldGained,
        endowmentStones: (user.endowmentStones || 0) + endowmentStones,
      });
    }
    res.json({ victory, logs: battleResult.log || [], expGained: victory ? 250 + (locationId * 100) : 0 });
  });

  // ── Gacha ─────────────────────────────────────────────────────────────────
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { isSpecial, count } = req.body;
    const pullCount = Math.min(count || 1, 10);
    const costPerPull = isSpecial ? 300 : 100;
    const totalCost   = costPerPull * pullCount;
    if (user.gold < totalCost) return res.status(400).json({ message: "Not enough gold" });
    await storage.updateUser(userId, { gold: user.gold - totalCost });
    const rarityFromSpecial = () => {
      const r = Math.random();
      if (r > 0.85) return "5";
      if (r > 0.60) return "4";
      if (r > 0.30) return "3";
      return "2";
    };
    const rarity = isSpecial ? rarityFromSpecial() : equipRarityFromRandom(1);
    const COMPANION_TYPES  = ["Samurai","Ninja","Monk","Archer","Mage","Berserker","Strategist","Healer"];
    const COMPANION_NAMES  = ["Takeshi","Yuki","Hiroshi","Sakura","Kenji","Akira","Ryu","Hana","Daichi","Mizuki"];
    const companion = await storage.createCompanion({
      userId,
      name:    pick(COMPANION_NAMES),
      type:    pick(COMPANION_TYPES),
      rarity,
      level:   1,
      attack:  10 + Math.floor(Math.random() * 20),
      defense: 5  + Math.floor(Math.random() * 10),
      speed:   10 + Math.floor(Math.random() * 10),
    });
    res.json({ companion });
  });

  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { count } = req.body;
    const pullCount = Math.min(count || 1, 10);
    const totalCost = 50 * pullCount;
    if (user.gold < totalCost) return res.status(400).json({ message: "Not enough gold" });
    await storage.updateUser(userId, { gold: user.gold - totalCost });
    const results: any[] = [];
    for (let i = 0; i < pullCount; i++) {
      const eqData = generateEquipment(userId, 1);
      const eq = await storage.createEquipment(eqData);
      results.push(eq);
    }
    res.json({ equipment: results });
  });

  // ── Endowment ─────────────────────────────────────────────────────────────
  app.post("/api/equipment/:id/endow", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { type, protect } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const allEquip = await storage.getEquipment(userId);
    const eq = allEquip.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });
    if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });
    const currentPoints = eq.endowmentPoints || 0;
    const baseRate   = type === 'extreme' ? 0.7 : 0.9;
    const successRate = Math.max(0.1, baseRate - (currentPoints * 0.02));
    const success    = Math.random() < successRate;
    const protection = protect && user.endowmentStones >= 2;
    const stonesUsed = protection ? 2 : 1;
    let pointsGained = 0;
    let newPoints    = currentPoints;
    if (success) {
      pointsGained = type === 'extreme' ? 3 : 1;
      newPoints    = currentPoints + pointsGained;
    } else if (!protection) {
      newPoints = Math.max(0, currentPoints - 1);
    }
    await storage.updateEquipment(equipId, { endowmentPoints: newPoints });
    await storage.updateUser(userId, { endowmentStones: user.endowmentStones - stonesUsed });
    res.json({ success, pointsGained, newPoints, stonesUsed });
  });

  // ── Campaign events ───────────────────────────────────────────────────────
  app.get("/api/campaign-events", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const events = await storage.getCampaignEvents(userId);
    res.json(events);
  });

  app.post("/api/campaign-events/:key/trigger", isAuthenticated, async (req: any, res) => {
    const userId   = req.user.claims.sub;
    const eventKey = req.params.key;
    const { choice } = req.body;
    const events = await storage.getCampaignEvents(userId);
    let event = events.find(e => e.eventKey === eventKey);
    if (!event) {
      event = await storage.createCampaignEvent({ userId, eventKey, isTriggered: false });
    }
    if (event.isTriggered) return res.status(400).json({ message: "Event already triggered" });
    await storage.updateCampaignEvent(event.id, { isTriggered: true, choice, completedAt: new Date() });
    res.json({ success: true });
  });

  // ── Map / Locations ───────────────────────────────────────────────────────
  app.get("/api/locations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    const locations = [
      { id: 1, name: "Owari Province",    description: "Nobunaga's homeland",         maxLevel: 1, isUnlocked: true },
      { id: 2, name: "Mino Province",     description: "The Viper's domain",           maxLevel: 2, isUnlocked: (user.currentLocationId || 1) >= 2 },
      { id: 3, name: "Kyoto",             description: "The Imperial capital",         maxLevel: 3, isUnlocked: (user.currentLocationId || 1) >= 3 },
      { id: 4, name: "Omi Province",      description: "Azai and Asakura territory",   maxLevel: 4, isUnlocked: (user.currentLocationId || 1) >= 4 },
      { id: 5, name: "Echizen Province",  description: "Northern gateway",             maxLevel: 5, isUnlocked: (user.currentLocationId || 1) >= 5 },
      { id: 6, name: "Nagashino",         description: "The gunpowder battlefield",    maxLevel: 6, isUnlocked: (user.currentLocationId || 1) >= 6 },
      { id: 101, name: "Yellow River",    description: "The rivers of ancient China", maxLevel: 7, isUnlocked: (user.currentLocationId || 1) >= 101 },
      { id: 102, name: "Chang'an",        description: "The eternal capital",          maxLevel: 8, isUnlocked: (user.currentLocationId || 1) >= 102 },
    ];
    res.json(locations);
  });

  const httpServer = (await import("http")).createServer(app);
  return httpServer;
}
