import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { api } from "@shared/routes";
import { runTurnBasedCombat, applyFlagModifiers } from "./combat";
import { storyRouter } from "./story-routes";
import { db } from "./db";
import { playerFlags } from "@shared/schema";
import { eq } from "drizzle-orm";
import { evalUnlockCondition, unlockConditionHint } from "@shared/schema";

// ─── Name pools ────────────────────────────────────────────────────────────────
const JP_ENEMY_NAMES = ["Ashigaru","Ronin","Bandit","Mercenary","Scout","Raider","Footsoldier","Brigand"];
const CN_ENEMY_NAMES = ["Soldier","Conscript","Raider","Bandit","Scout","Mercenary","Rebel","Warlord's Guard"];
const JP_BOSS_NAMES  = ["Warlord","Demon General","Shadow Daimyo","Blood Oni","Iron Samurai","Thunder Lord"];
const CN_BOSS_NAMES  = ["Dragon General","Iron Warlord","Shadow Emperor","Thunder Khan","Fire Lord","Celestial Warrior"];

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

function generateEquipment(userId: string, locationId: number = 1, isBoss = false) {
  const rarity = equipRarityFromRandom(locationId);
  const types  = ["Weapon","Armor","Shield","HeadgearUpper","Accessory","Garment","Footgear"];
  const type   = isBoss ? pick(["Weapon","Armor"]) : pick(types);
  let name: string;
  if (type === "Weapon")       name = pick(WEAPON_NAMES[pick(Object.keys(WEAPON_NAMES))]);
  else if (type === "Armor")   name = pick(ARMOR_NAMES);
  else if (type === "Shield")  name = pick(SHIELD_NAMES);
  else if (type === "HeadgearUpper") name = pick(HELMET_NAMES);
  else                         name = pick(ACC_NAMES);
  const ri   = RARITY_ORDER.indexOf(rarity);
  const mult = 1 + ri * 0.5 + (locationId - 1) * 0.1;
  return {
    userId, name, type, rarity,
    attackBonus:  type === "Weapon" ? Math.floor((10 + Math.random() * 20) * mult) : 0,
    defenseBonus: ["Armor","Shield","Garment","Footgear"].includes(type) ? Math.floor((5  + Math.random() * 10) * mult) : 0,
    speedBonus:   type === "Footgear" ? Math.floor((2 + Math.random() * 5) * mult) : 0,
    hpBonus:      type === "Armor"    ? Math.floor((10 + Math.random() * 20) * mult) : 0,
    level: 1, isEquipped: false,
    cardSlots: ri >= 5 ? 1 : 0,
  };
}

function equipRarityFromRandom(locationId = 1): string {
  const r = Math.random();
  if (locationId >= 100) {
    const b = (locationId - 100) * 0.02;
    if (r > 0.985 - b) return "celestial";
    if (r > 0.965 - b) return "transcendent";
    if (r > 0.92  - b) return "exotic";
    if (r > 0.85  - b) return "gold";
    if (r > 0.75  - b) return "red";
    if (r > 0.60  - b) return "orange";
    if (r > 0.40  - b) return "purple";
    if (r > 0.20  - b) return "blue";
    if (r > 0.10  - b) return "green";
    return "white";
  }
  const b = (locationId - 1) * 0.03;
  if (r > 0.995 - b / 5) return "celestial";
  if (r > 0.985 - b / 2) return "transcendent";
  if (r > 0.97  - b)     return "exotic";
  if (r > 0.95  - b)     return "gold";
  if (r > 0.90  - b)     return "red";
  if (r > 0.82  - b)     return "orange";
  if (r > 0.70  - b)     return "purple";
  if (r > 0.50  - b)     return "blue";
  if (r > 0.25  - b)     return "green";
  return "white";
}

async function giveEquipmentExp(userId: string, expAmount: number) {
  const allEquip  = await storage.getEquipment(userId);
  const equipped  = allEquip.filter(e => e.isEquipped);
  for (const eq of equipped) {
    const newExp      = (eq.experience || 0) + Math.floor(expAmount / 4);
    const newExpToNext = eq.expToNext || 100;
    if (newExp >= newExpToNext) {
      await storage.updateEquipment(eq.id, { level: (eq.level || 1) + 1, experience: newExp - newExpToNext, expToNext: Math.floor(newExpToNext * 1.5) });
    } else {
      await storage.updateEquipment(eq.id, { experience: newExp });
    }
  }
}

async function getPlayerTeamStats(userId: string) {
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

  const STR  = (user as any).str  || 1;
  const AGI  = (user as any).agi  || 1;
  const VIT  = (user as any).vit  || 1;
  const INT  = (user as any).int  || 1;
  const DEX  = (user as any).dex  || 1;
  const LUK  = (user as any).luk  || 1;
  const Lv   = user.level;

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
    const cWeaponAtk  = cWeapon ? Math.floor((cWeapon.attackBonus || 0) * (1 + (cWeapon.level - 1) * 0.1)) : 0;
    const cHardDEF    = (c.defense || 0) + cDefBonus;
    const cMaxHp      = Math.floor(((c.maxHp || 50) * (1 + 0.01 * cVIT))) + cHpBonus;

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

  // Pet aura: buffs every party member
  if (activePet) {
    for (const member of [stats.player, ...stats.companions]) {
      member.attack  = Math.floor(member.attack  * (1 + (activePet.attack  || 5)  / 100));
      member.defense = Math.floor(member.defense * (1 + (activePet.defense || 5)  / 100));
      member.speed   = Math.floor(member.speed   * (1 + (activePet.speed   || 15) / 200));
    }
  }

  // Horse bonus: flat additions to every party member
  if (activeHorse) {
    for (const member of [stats.player, ...stats.companions]) {
      member.attack  += activeHorse.attackBonus  || 0;
      member.defense += activeHorse.defenseBonus || 0;
      member.speed   += activeHorse.speedBonus   || 10;
    }
  }

  return stats;
}

function generateEnemyStats(type: "field" | "boss" | "special", playerLevel: number, locationId = 1) {
  let targetLevel = locationId >= 100 ? 7 + (locationId - 101) : locationId;
  const locMult   = 1 + (targetLevel - 1) * 0.1;

  const baseStats = (lvl: number) => ({
    str: Math.floor(lvl * 1.5),
    agi: Math.floor(lvl * 1.2),
    vit: Math.floor(lvl * 1.3),
    int: Math.floor(lvl * 0.8),
    dex: Math.floor(lvl * 1.4),
    luk: Math.max(1, Math.floor(lvl * 0.5)),
  });

  if (type === "field") {
    const name   = locationId >= 100 ? pick(CN_ENEMY_NAMES) : pick(JP_ENEMY_NAMES);
    const lvl    = targetLevel;
    const stats  = baseStats(lvl);
    const hDEF   = Math.floor((lvl * 8  + 15) * locMult);
    const wATK   = Math.floor((lvl * 10 + 20) * locMult);
    return {
      name, level: lvl,
      hp: Math.floor((lvl * 50 + 100) * locMult), maxHp: Math.floor((lvl * 50 + 100) * locMult),
      attack: wATK, defense: hDEF, speed: Math.floor((lvl * 5 + 10) * locMult),
      weaponType: "none", ...stats, weaponATK: wATK, weaponLevel: 1, hardDEF: hDEF, softDEF: 0,
      hit:  175 + lvl + stats.dex + Math.floor(stats.luk / 3),
      flee: 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10),
      skills: ["Scratch","Bite"],
      statusEffects: [],
    };
  }

  if (type === "boss") {
    const name  = locationId >= 100 ? pick(CN_BOSS_NAMES) : pick(JP_BOSS_NAMES);
    const lvl   = targetLevel + 2;
    const stats = baseStats(lvl);
    stats.vit = Math.floor(stats.vit * 1.3);
    stats.agi = Math.floor(stats.agi * 1.2);
    const hDEF = Math.floor((lvl * 25 + 80)  * locMult);
    const wATK = Math.floor((lvl * 30 + 100) * locMult);
    return {
      name, level: lvl,
      hp: Math.floor((lvl * 200 + 1000) * locMult), maxHp: Math.floor((lvl * 200 + 1000) * locMult),
      attack: wATK, defense: hDEF, speed: Math.floor((lvl * 15 + 50) * locMult),
      weaponType: "none", ...stats, weaponATK: wATK, weaponLevel: 2, hardDEF: hDEF, softDEF: 0,
      hit:  175 + lvl + stats.dex + Math.floor(stats.luk / 3),
      flee: 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10),
      skills: ["War Cry","Shield Wall","Charge","Strategic Strike"],
      statusEffects: [],
    };
  }

  // special
  const sb   = pick(SPECIAL_BOSSES);
  const name = locationId >= 100 ? "Celestial Dragon Emperor" : sb.name;
  const lvl  = targetLevel + 5;
  const stats = baseStats(lvl);
  stats.vit = Math.floor(stats.vit * 1.6);
  stats.agi = Math.floor(stats.agi * 1.3);
  stats.dex = Math.floor(stats.dex * 1.2);
  const hDEF = Math.floor((lvl * 40 + 150) * locMult);
  const wATK = Math.floor((lvl * 50 + 200) * locMult);
  return {
    name, level: lvl,
    hp: Math.floor((lvl * 500 + 3000) * locMult), maxHp: Math.floor((lvl * 500 + 3000) * locMult),
    attack: wATK, defense: hDEF, speed: Math.floor((lvl * 30 + 100) * locMult),
    weaponType: "none", ...stats, weaponATK: wATK, weaponLevel: 3, hardDEF: hDEF, softDEF: 0,
    hit:  175 + lvl + stats.dex + Math.floor(stats.luk / 3),
    flee: 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10),
    skills: [sb.skill,"Roar","Dark Aura","Divine Intervention"],
    statusEffects: [],
  };
}

// ─── A2: Load player flag map ──────────────────────────────────────────────────
async function getPlayerFlagMap(userId: string): Promise<Record<string, number>> {
  const rows = await db.select().from(playerFlags).where(eq(playerFlags.userId, userId));
  const out: Record<string, number> = {};
  for (const row of rows) out[row.flagKey] = row.flagValue;
  return out;
}

// ─── Route registration ────────────────────────────────────────────────────────

export async function registerRoutes(server: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ── Story engine ─────────────────────────────────────────────────────────
  app.use("/api/story", isAuthenticated, storyRouter);

  // ── Onboarding ──────────────────────────────────────────────────────────
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

  // ── Player ──────────────────────────────────────────────────────────────
  app.get(api.player.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "Player not found" });
    res.json(user);
  });

  // fix: was "/api/player/full-status" — client calls /api/player/status (api.player.fullStatus.path)
  app.get(api.player.fullStatus.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const team   = await getPlayerTeamStats(userId);
    if (!team) return res.status(404).json({ message: "Player not found" });
    res.json(team);
  });

  app.post("/api/restart", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    await storage.createEquipment({
      userId, name: "Training Sword", type: "Weapon", weaponType: "sword",
      rarity: "white", level: 1, attackBonus: 10, isEquipped: true,
    });
    res.json({ success: true });
  });

  // ── Companions ──────────────────────────────────────────────────────────
  app.get(api.companions.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const raw    = await storage.getCompanions(userId);

    const needsFlags = raw.some((c: any) => c.flagUnlockCondition);
    const flagMap    = needsFlags ? await getPlayerFlagMap(userId) : {};

    const companions = raw.map((c: any) => {
      const condition: string | null = c.flagUnlockCondition ?? null;
      const { flagUnlockCondition: _stripped, ...rest } = c;

      if (!condition) {
        return { ...rest, isLocked: false, lockReason: null };
      }

      const unlocked = evalUnlockCondition(condition, flagMap);
      return {
        ...rest,
        isLocked:   !unlocked,
        lockReason: unlocked ? null : unlockConditionHint(condition, flagMap),
      };
    });

    res.json(companions);
  });

  app.post(api.companions.setParty.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { companionIds } = req.body;
    if (!Array.isArray(companionIds)) return res.status(400).json({ message: "companionIds must be an array" });
    if (companionIds.length > 3)      return res.status(400).json({ message: "Maximum 3 companions in party" });

    const all    = await storage.getCompanions(userId);

    const flagMap    = await getPlayerFlagMap(userId);
    for (const id of companionIds) {
      const comp = all.find((c: any) => c.id === id) as any;
      if (!comp) continue;
      if (comp.flagUnlockCondition) {
        const unlocked = evalUnlockCondition(comp.flagUnlockCondition, flagMap);
        if (!unlocked) {
          return res.status(403).json({
            message: `${comp.name} is loyalty-locked: ${unlockConditionHint(comp.flagUnlockCondition, flagMap)}`,
          });
        }
      }
    }

    const names = all.filter((c: any) => companionIds.includes(c.id)).map((c: any) => c.name);
    if (new Set(names).size !== names.length) return res.status(400).json({ message: "Duplicate companion names not allowed" });
    await storage.updateParty(userId, companionIds);
    res.json({ success: true });
  });

  // ── Equipment ───────────────────────────────────────────────────────────
  app.get(api.equipment.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getEquipment(userId));
  });

  app.post("/api/equipment/:id/equip", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { targetType, targetId } = req.body;
    const all  = await storage.getEquipment(userId);
    const item = all.find(e => e.id === equipId);
    if (!item) return res.status(404).json({ message: "Equipment not found" });
    const clash = all.find(e => e.isEquipped && e.type === item.type && e.equippedToType === (targetType || "player") && e.equippedToId === (targetId || null) && e.id !== equipId);
    if (clash) await storage.updateEquipment(clash.id, { isEquipped: false, equippedToType: null, equippedToId: null });
    await storage.updateEquipment(equipId, { isEquipped: true, equippedToType: targetType || "player", equippedToId: targetId || null });
    res.json({ success: true });
  });

  app.post("/api/equipment/:id/unequip", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const all  = await storage.getEquipment(userId);
    if (!all.find(e => e.id === equipId)) return res.status(404).json({ message: "Equipment not found" });
    await storage.updateEquipment(equipId, { isEquipped: false, equippedToType: null, equippedToId: null });
    res.json({ success: true });
  });

  app.post("/api/equipment/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { equipmentIds } = req.body;
    if (!Array.isArray(equipmentIds) || equipmentIds.length === 0)
      return res.status(400).json({ message: "equipmentIds required" });
    let stonesGained = 0;
    for (const id of equipmentIds) {
      const all    = await storage.getEquipment(userId);
      const target = all.find(e => e.id === Number(id));
      if (!target || target.userId !== userId || target.isEquipped) continue;
      const user = await storage.getUser(userId);
      if (!user) continue;
      await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + 5 });
      await storage.deleteEquipment(Number(id));
      stonesGained += 5;
    }
    res.json({ success: true, stonesGained });
  });

  app.post(api.equipment.recycleRarity.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      res.json(await storage.recycleEquipment(userId));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/equipment/:id/insert-card", isAuthenticated, async (req: any, res) => {
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
    res.json(await storage.getCards(userId));
  });

  // ── Stats upgrade ───────────────────────────────────────────────────────
  // fix: was "/api/stats/upgrade" — client calls /api/player/stats/upgrade (api.stats.upgrade.path)
  app.post(api.stats.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { stat } = req.body;
    const valid = ["str","agi","vit","int","dex","luk"];
    if (!valid.includes(stat)) return res.status(400).json({ message: "Invalid stat" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const cur = (user as any)[stat] || 1;
    if (cur >= 99) return res.status(400).json({ message: "Stat already at maximum" });
    const cost = Math.floor(2 + cur * 0.5);
    if (user.statPoints < cost) return res.status(400).json({ message: "Not enough stat points" });
    await storage.updateUser(userId, { [stat]: cur + 1, statPoints: user.statPoints - cost });
    res.json({ success: true, newValue: cur + 1, pointsUsed: cost });
  });

  // fix: was "/api/stats/bulk-upgrade" — client calls /api/player/stats/bulk-upgrade (api.stats.bulkUpgrade.path)
  app.post(api.stats.bulkUpgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { upgrades } = req.body;
    const valid = ["str","agi","vit","int","dex","luk"];
    const user  = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    let totalCost = 0;
    const updates: any = {};
    for (const [stat, amount] of Object.entries(upgrades as Record<string, number>)) {
      if (!valid.includes(stat)) return res.status(400).json({ message: `Invalid stat: ${stat}` });
      const val = (user as any)[stat] || 1;
      if (val + amount > 99) return res.status(400).json({ message: `${stat} would exceed max` });
      let cost = 0;
      for (let i = 0; i < amount; i++) cost += Math.floor(2 + (val + i) * 0.5);
      totalCost += cost;
      updates[stat] = val + amount;
    }
    if (user.statPoints < totalCost) return res.status(400).json({ message: "Not enough stat points" });
    updates.statPoints = user.statPoints - totalCost;
    await storage.updateUser(userId, updates);
    res.json({ success: true, pointsUsed: totalCost });
  });

  // ── Pets ────────────────────────────────────────────────────────────────
  app.get(api.pets.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getPets(req.user.claims.sub));
  });

  app.post(api.pets.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId  = Number(req.params.id);
    for (const p of await storage.getPets(userId)) await storage.updatePet(p.id, { isActive: false });
    await storage.updatePet(petId, { isActive: true });
    res.json({ success: true });
  });

  app.post("/api/pets/:id/deactivate", isAuthenticated, async (req: any, res) => {
    await storage.updatePet(Number(req.params.id), { isActive: false });
    res.json({ success: true });
  });

  app.post("/api/pets/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId  = Number(req.params.id);
    const { upgradeAmount } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.petEssence || 0) < upgradeAmount) return res.status(400).json({ message: "Not enough pet essence" });
    const pet = (await storage.getPets(userId)).find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    await storage.updatePet(petId, {
      level:   (pet.level   || 1)  + upgradeAmount,
      attack:  (pet.attack  || 5)  + upgradeAmount * 2,
      defense: (pet.defense || 5)  + upgradeAmount,
      speed:   (pet.speed   || 15) + upgradeAmount,
    });
    await storage.updateUser(userId, { petEssence: user.petEssence - upgradeAmount });
    res.json({ success: true, newLevel: (pet.level || 1) + upgradeAmount });
  });

  // ── Horses ──────────────────────────────────────────────────────────────
  app.get(api.horses.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getHorses(req.user.claims.sub));
  });

  app.post(api.horses.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const horseId = Number(req.params.id);
    for (const h of await storage.getHorses(userId)) await storage.updateHorse(h.id, { isActive: false });
    await storage.updateHorse(horseId, { isActive: true });
    res.json({ success: true });
  });

  app.post("/api/horses/:id/deactivate", isAuthenticated, async (req: any, res) => {
    await storage.updateHorse(Number(req.params.id), { isActive: false });
    res.json({ success: true });
  });

  app.post(api.horses.recycle.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const horseId = Number(req.params.id);
    const all     = await storage.getHorses(userId);
    const horse   = all.find(h => h.id === horseId);
    if (!horse || horse.userId !== userId) return res.status(404).json({ message: "Horse not found" });
    if (horse.isActive) return res.status(400).json({ message: "Cannot recycle your active horse" });
    await storage.deleteHorse(horseId);
    const goldGained = 20;
    const user = await storage.getUser(userId);
    if (user) await storage.updateUser(userId, { gold: user.gold + goldGained });
    res.json({ success: true, goldGained });
  });

  app.post(api.horses.combine.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { horseIds } = req.body;
    if (!Array.isArray(horseIds) || horseIds.length < 2) return res.status(400).json({ message: "Need at least 2 horses" });
    const all      = await storage.getHorses(userId);
    const selected = all.filter(h => horseIds.includes(String(h.id)) || horseIds.includes(h.id));
    if (selected.length < 2) return res.status(400).json({ message: "Horses not found" });
    const base      = selected[0];
    const rarities  = ["white","green","blue","purple","orange","red","gold","exotic","transcendent","celestial"];
    const idx       = rarities.indexOf(base.rarity);
    const upgraded  = Math.random() < 0.3;
    const newRarity = rarities[upgraded && idx < rarities.length - 1 ? idx + 1 : idx];
    for (const id of horseIds) await storage.deleteHorse(Number(id));
    const newHorse = await storage.createHorse({
      userId, name: base.name, rarity: newRarity,
      speedBonus:   base.speedBonus   + (upgraded ? 5 : 2),
      attackBonus:  base.attackBonus,
      defenseBonus: base.defenseBonus,
      skill: base.skill, isActive: false,
    });
    res.json({ success: true, upgraded, newHorse });
  });

  // ── Transformations ─────────────────────────────────────────────────────
  app.get(api.transformations.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getTransformations(req.user.claims.sub));
  });

  app.post("/api/transformations/:id/activate", isAuthenticated, async (req: any, res) => {
    const userId      = req.user.claims.sub;
    const transformId = Number(req.params.id);
    const transform   = (await storage.getTransformations(userId)).find(t => t.id === transformId);
    if (!transform) return res.status(404).json({ message: "Transformation not found" });
    const activeUntil = new Date(Date.now() + (transform.durationSeconds || 30) * 1000);
    await storage.updateUser(userId, { activeTransformId: transformId, transformActiveUntil: activeUntil });
    res.json({ success: true, activeUntil });
  });

  // ── Quests ──────────────────────────────────────────────────────────────
  app.get(api.quests.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getQuests(req.user.claims.sub));
  });

  app.post("/api/quests/:key/claim", isAuthenticated, async (req: any, res) => {
    res.json(await storage.claimQuest(req.user.claims.sub, req.params.key));
  });

  // ── Field skirmish ───────────────────────────────────────────────────────
  app.post(api.battle.field.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const locationId  = Number(req.body.locationId)  || 1;
    const repeatCount = Math.min(Math.max(1, Number(req.body.repeatCount) || 1), 10);
    const teamStats   = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    let totalExp  = 0;
    let totalGold = 0;
    const allLogs: string[]  = [];
    const dropped: any[]     = [];
    let ninjaEncounter: any  = null;

    for (let i = 0; i < repeatCount; i++) {
      if (repeatCount > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);

      if (!ninjaEncounter && Math.random() < (locationId >= 100 ? 0.05 : 0.03)) {
        const names  = locationId >= 100
          ? ["Zhuge Liang (Ghost)","Lu Bu's Spirit","Empress Wu Zetian"]
          : ["Hattori Hanzo","Fuma Kotaro","Ishikawa Goemon","Mochizuki Chiyome"];
        const lvl    = locationId >= 100 ? 7 + (locationId - 100) : locationId;
        const strong = Math.random() < (locationId >= 100 ? 0.5 : 0.3);
        ninjaEncounter = {
          name: pick(names), level: strong ? lvl + 20 : lvl + 2,
          hp: strong ? 5000 : 1000, maxHp: strong ? 5000 : 1000,
          attack: strong ? 500 : 100, defense: strong ? 300 : 50, speed: strong ? 200 : 80,
          weaponType: "sword", str:20, agi:20, vit:20, int:10, dex:20, luk:10,
          weaponATK: strong ? 500 : 100, weaponLevel:3, hardDEF:50, softDEF:0,
          hit:220, flee:150, skills:["Shadow Strike","Vanish"], statusEffects: [],
        };
        allLogs.push(`A famous warrior, ${ninjaEncounter.name}, blocks your path!`);
        break;
      }

      const enemy = generateEnemyStats("field", user.level, locationId);
      if (i === 0 && req.body.enemyName) enemy.name = req.body.enemyName;

      const modLogs = await applyFlagModifiers(userId, teamStats, [enemy]);
      allLogs.push(...modLogs);

      const result  = runTurnBasedCombat(teamStats, [enemy]);
      allLogs.push(...(result.logs || []));

      if (result.victory) {
        await storage.updateQuestProgress(userId, "daily_skirmish",       1);
        await storage.updateQuestProgress(userId, "daily_skirmish_elite", 1);
        const exp  = Math.floor(Math.random() * 50) + 30 + enemy.level * 5;
        const gold = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        totalExp  += exp;
        totalGold += gold;

        let xp = user.experience + totalExp;
        let lv = user.level;
        let mhp = user.maxHp;
        let sp  = user.statPoints;
        while (xp >= lv * 100) { xp -= lv * 100; lv++; mhp += 10; sp += 3; }
        await storage.updateUser(userId, { experience: xp, level: lv, maxHp: mhp, statPoints: sp, gold: user.gold + totalGold });

        if (Math.random() < 0.01) {
          try { dropped.push(await storage.createEquipment(generateEquipment(userId, locationId))); } catch {}
        }
      }
    }

    await giveEquipmentExp(userId, totalExp);
    res.json({
      victory: allLogs.some(l => l.includes("Victory")),
      logs: allLogs, expGained: totalExp, goldGained: totalGold,
      equipmentDropped: dropped, ninjaEncounter,
    });
  });

  // ── Ninja battle ─────────────────────────────────────────────────────────
  app.post(api.battle.ninja.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { ninjaStats } = req.body;
    if (!ninjaStats) return res.status(400).json({ message: "ninjaStats required" });
    const team = await getPlayerTeamStats(userId);
    if (!team) return res.status(400).json({ message: "Team not found" });

    if (!(ninjaStats as any).statusEffects) (ninjaStats as any).statusEffects = [];

    const modLogs = await applyFlagModifiers(userId, team, [ninjaStats]);
    const result  = runTurnBasedCombat(team, [ninjaStats]);

    if (result.victory) {
      await storage.updateUser(userId, {
        experience:   user.experience + 100,
        gold:         user.gold + 50,
        warriorSouls: (user.warriorSouls || 0) + 1,
      });
    }
    res.json({ victory: result.victory, logs: [...modLogs, ...(result.logs || [])] });
  });

  // ── Boss battle ──────────────────────────────────────────────────────────
  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { locationId: rawLoc, goldDemanded } = req.body;
    const locationId = Number(rawLoc) || 1;
    if (!goldDemanded)         return res.status(400).json({ message: "goldDemanded required" });
    if (user.gold < goldDemanded) return res.status(400).json({ message: "Not enough gold" });
    await storage.updateUser(userId, { gold: user.gold - goldDemanded });

    const team = await getPlayerTeamStats(userId);
    if (!team) return res.status(400).json({ message: "Team not found" });
    const enemy = generateEnemyStats("boss", user.level, locationId);

    const modLogs = await applyFlagModifiers(userId, team, [enemy]);
    const result  = runTurnBasedCombat(team, [enemy]);

    if (result.victory) {
      await storage.updateUser(userId, {
        gold:             user.gold - goldDemanded + goldDemanded * 2,
        endowmentStones:  (user.endowmentStones || 0) + 3 + Math.floor(Math.random() * 3),
      });
      await storage.updateQuestProgress(userId, "daily_boss", 1);
    }
    res.json({ victory: result.victory, logs: [...modLogs, ...(result.logs || [])], enemy });
  });

  // ── Campaign battle ──────────────────────────────────────────────────────
  app.post(api.battle.campaign.path, isAuthenticated, async (req: any, res) => {
    const userId     = req.user.claims.sub;
    const user       = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const team       = await getPlayerTeamStats(userId);
    if (!team) return res.status(400).json({ message: "Team not found" });
    const enemy = generateEnemyStats("boss", user.level, locationId);

    const modLogs = await applyFlagModifiers(userId, team, [enemy]);
    const result  = runTurnBasedCombat(team, [enemy]);

    if (result.victory) {
      const exp   = 100 + locationId * 50;
      const gold  = 50  + locationId * 25;
      const rice  = 10  + locationId * 5;
      const eStones = 2 + Math.floor(Math.random() * 3);
      let xp = user.experience + exp;
      let lv = user.level;
      let mhp = user.maxHp;
      let sp  = user.statPoints;
      let spd = user.speed;
      while (xp >= lv * 100) { xp -= lv * 100; lv++; mhp += 10; sp += 3; spd += 2; }
      await storage.updateUser(userId, {
        level: lv, experience: xp, maxHp: mhp, statPoints: sp, speed: spd,
        gold: user.gold + gold, rice: (user.rice || 0) + rice,
        endowmentStones: (user.endowmentStones || 0) + eStones,
        currentLocationId: Math.max(user.currentLocationId || 1, locationId),
      });
      const eqDrop: any[] = [];
      if (Math.random() < 0.05) {
        try { eqDrop.push(await storage.createEquipment(generateEquipment(userId, locationId, true))); } catch {}
      }
      return res.json({ victory: true, logs: [...modLogs, ...(result.logs || [])], expGained: exp, goldGained: gold, riceGained: rice, equipmentDropped: eqDrop, petDropped: null });
    }
    res.json({ victory: false, logs: [...modLogs, ...(result.logs || [])], expGained: 0, goldGained: 0, riceGained: 0, equipmentDropped: [], petDropped: null });
  });

  // ── Special boss battle ──────────────────────────────────────────────────
  app.post(api.battle.special.path, isAuthenticated, async (req: any, res) => {
    const userId     = req.user.claims.sub;
    const user       = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const team       = await getPlayerTeamStats(userId);
    if (!team) return res.status(400).json({ message: "Team not found" });
    const enemy = generateEnemyStats("special", user.level, locationId);

    const modLogs = await applyFlagModifiers(userId, team, [enemy]);
    const result  = runTurnBasedCombat(team, [enemy]);

    if (result.victory) {
      const exp   = 250 + locationId * 100;
      const gold  = 150 + locationId * 75;
      const eStones = 5 + Math.floor(Math.random() * 6);
      let xp = user.experience + exp;
      let lv = user.level;
      let mhp = user.maxHp;
      let sp  = user.statPoints;
      let spd = user.speed;
      while (xp >= lv * 100) { xp -= lv * 100; lv++; mhp += 10; sp += 3; spd += 2; }
      await storage.updateUser(userId, {
        level: lv, experience: xp, maxHp: mhp, statPoints: sp, speed: spd,
        gold: user.gold + gold, endowmentStones: (user.endowmentStones || 0) + eStones,
      });
      return res.json({ victory: true, logs: [...modLogs, ...(result.logs || [])], expGained: exp });
    }
    res.json({ victory: false, logs: [...modLogs, ...(result.logs || [])], expGained: 0 });
  });

  // ── Gacha ────────────────────────────────────────────────────────────────
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const { isSpecial, count } = req.body;
    const pullCount = Math.min(count || 1, 10);
    const costPerPull = isSpecial ? 300 : 100;
    if (user.gold < costPerPull * pullCount) return res.status(400).json({ message: "Not enough gold" });
    await storage.updateUser(userId, { gold: user.gold - costPerPull * pullCount });
    const rarity = isSpecial
      ? (() => { const r = Math.random(); return r > 0.85 ? "5" : r > 0.60 ? "4" : r > 0.30 ? "3" : "2"; })()
      : equipRarityFromRandom(1);
    const TYPES  = ["Samurai","Ninja","Monk","Archer","Mage","Berserker","Strategist","Healer"];
    const NAMES  = ["Takeshi","Yuki","Hiroshi","Sakura","Kenji","Akira","Ryu","Hana","Daichi","Mizuki"];
    const companion = await storage.createCompanion({
      userId, name: pick(NAMES), type: pick(TYPES), rarity, level: 1,
      attack: 10 + Math.floor(Math.random() * 20),
      defense: 5 + Math.floor(Math.random() * 10),
      speed:  10 + Math.floor(Math.random() * 10),
    });
    await storage.updateQuestProgress(userId, "daily_gacha",       1);
    await storage.updateQuestProgress(userId, "daily_gacha_elite", 1);
    res.json({ companion });
  });

  // fix: was api.gacha.pullEquipment.path already but let's keep it consistent
  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const pullCount = Math.min(req.body.count || 1, 10);
    if (user.gold < 50 * pullCount) return res.status(400).json({ message: "Not enough gold" });
    await storage.updateUser(userId, { gold: user.gold - 50 * pullCount });
    const results: any[] = [];
    for (let i = 0; i < pullCount; i++) results.push(await storage.createEquipment(generateEquipment(userId, 1)));
    res.json({ equipment: results });
  });

  // ── Endowment ────────────────────────────────────────────────────────────
  app.post("/api/equipment/:id/endow", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { type, protect } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const all = await storage.getEquipment(userId);
    const eq  = all.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });
    if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });
    const cur         = eq.endowmentPoints || 0;
    const baseRate    = type === "extreme" ? 0.7 : 0.9;
    const successRate = Math.max(0.1, baseRate - cur * 0.02);
    const success     = Math.random() < successRate;
    const stonesUsed  = protect && user.endowmentStones >= 2 ? 2 : 1;
    let newPoints     = cur;
    let pointsGained  = 0;
    if (success) {
      pointsGained = type === "extreme" ? 3 : 1;
      newPoints    = cur + pointsGained;
    } else if (stonesUsed === 1) {
      newPoints = Math.max(0, cur - 1);
    }
    await storage.updateEquipment(equipId, { endowmentPoints: newPoints });
    await storage.updateUser(userId, { endowmentStones: user.endowmentStones - stonesUsed });
    res.json({ success, pointsGained, newPoints, stonesUsed });
  });

  // ── Campaign events ──────────────────────────────────────────────────────
  // fix: was "/api/campaign-events" — client calls /api/campaign/events (api.campaign.events.path)
  app.get(api.campaign.events.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getCampaignEvents(req.user.claims.sub));
  });

  // fix: was "/api/campaign-events/:key/trigger" — client calls /api/campaign/events/trigger with eventKey in body
  app.post(api.campaign.triggerEvent.path, isAuthenticated, async (req: any, res) => {
    const userId   = req.user.claims.sub;
    const { eventKey, choice } = req.body;
    if (!eventKey) return res.status(400).json({ message: "eventKey required" });
    const events = await storage.getCampaignEvents(userId);
    let event = events.find(e => e.eventKey === eventKey);
    if (!event) event = await storage.createCampaignEvent({ userId, eventKey, isTriggered: false });
    if (event.isTriggered) return res.status(400).json({ message: "Event already triggered" });
    await storage.updateCampaignEvent(event.id, { isTriggered: true, choice, completedAt: new Date() });
    res.json({ success: true });
  });

  // ── Locations ────────────────────────────────────────────────────────────
  app.get("/api/locations", isAuthenticated, async (req: any, res) => {
    const user = await storage.getUser(req.user.claims.sub);
    if (!user) return res.status(404).json({ message: "Not found" });
    const cur = user.currentLocationId || 1;
    res.json([
      { id: 1,   name: "Owari Province",   description: "Nobunaga's homeland",         maxLevel: 1, isUnlocked: true },
      { id: 2,   name: "Mino Province",    description: "The Viper's domain",           maxLevel: 2, isUnlocked: cur >= 2 },
      { id: 3,   name: "Kyoto",            description: "The Imperial capital",         maxLevel: 3, isUnlocked: cur >= 3 },
      { id: 4,   name: "Omi Province",     description: "Azai and Asakura territory",   maxLevel: 4, isUnlocked: cur >= 4 },
      { id: 5,   name: "Echizen Province", description: "Northern gateway",             maxLevel: 5, isUnlocked: cur >= 5 },
      { id: 6,   name: "Nagashino",        description: "The gunpowder battlefield",    maxLevel: 6, isUnlocked: cur >= 6 },
      { id: 101, name: "Yellow River",     description: "The rivers of ancient China", maxLevel: 7, isUnlocked: cur >= 101 },
      { id: 102, name: "Chang'an",         description: "The eternal capital",          maxLevel: 8, isUnlocked: cur >= 102 },
    ]);
  });

  // Companions recycle
  app.post("/api/companions/:id/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const compId = Number(req.params.id);
    const all    = await storage.getCompanions(userId);
    const comp   = all.find((c: any) => c.id === compId);
    if (!comp || (comp as any).userId !== userId) return res.status(404).json({ message: "Companion not found" });
    if (comp.isInParty) return res.status(400).json({ message: "Cannot dismiss a companion in your active party" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteCompanion(compId);
    await storage.updateUser(userId, { warriorSouls: (user.warriorSouls || 0) + 3 });
    res.json({ success: true, soulsGained: 3 });
  });

  // Companions upgrade
  app.post("/api/companions/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const compId = Number(req.params.id);
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.warriorSouls || 0) < 10) return res.status(400).json({ message: "Not enough Warrior Souls (need 10)" });
    const all  = await storage.getCompanions(userId);
    const comp = all.find((c: any) => c.id === compId) as any;
    if (!comp || comp.userId !== userId) return res.status(404).json({ message: "Companion not found" });
    await storage.updateCompanion(compId, {
      level:   (comp.level   || 1) + 1,
      attack:  (comp.attack  || 10) + 5,
      defense: (comp.defense || 5)  + 2,
      speed:   (comp.speed   || 10) + 1,
      maxHp:   (comp.maxHp   || 50) + 10,
    });
    await storage.updateUser(userId, { warriorSouls: user.warriorSouls - 10 });
    res.json({ success: true });
  });

  return server;
}
