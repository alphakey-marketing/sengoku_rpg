import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { pick } from "../utils";
import { getStoryUnlockedPool, buildStoryEquipmentDrop } from "../generators/entities";

/**
 * Probability that any given equipment pull is replaced by a story-unlocked
 * item from the player's eligible pool (only applies when pool is non-empty).
 *
 * 25% feels meaningful without flooding the player's inventory with named
 * historical pieces — they stay special because they're still not guaranteed.
 */
const STORY_DROP_CHANCE = 0.25;

function rarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.99) return "5";
  if (r > 0.90) return "4";
  if (r > 0.75) return "3";
  if (r > 0.50) return "2";
  return "1";
}

export function registerGachaRoutes(app: Express) {
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const isSpecial = req.body?.isSpecial || false;
    const count     = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user      = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const singleCost = isSpecial ? 50 : 10;
    const totalCost  = singleCost * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, { rice: user.rice - totalCost });

    const warriorPool = [
      { name: "Oda Nobunaga",       skill: "Demon King's Command",  type: "General"    },
      { name: "Toyotomi Hideyoshi", skill: "Ape's Cunning",         type: "Strategist" },
      { name: "Tokugawa Ieyasu",    skill: "Patient Turtle",        type: "Defender"   },
      { name: "Hattori Hanzo",      skill: "Shadow Strike",         type: "Ninja"      },
      { name: "Sanada Yukimura",    skill: "Crimson Charge",        type: "Lancer"     },
      { name: "Date Masamune",      skill: "One-Eyed Dragon",       type: "Ronin"      },
      { name: "Uesugi Kenshin",     skill: "God of War",            type: "Monk"       },
      { name: "Takeda Shingen",     skill: "Furin-kazan",           type: "General"    },
      { name: "Miyamoto Musashi",   skill: "Niten Ichi-ryu",        type: "Samurai"    },
      { name: "Sasaki Kojiro",      skill: "Swallow Cut",           type: "Samurai"    },
      { name: "Honda Tadakatsu",    skill: "Unscathed General",     type: "Defender"   },
      { name: "Akechi Mitsuhide",   skill: "Tenka Fubu",            type: "Tactician"  },
    ];

    const rarityFromSpecial = () => {
      const r = Math.random();
      if (r > 0.85) return "5";
      if (r > 0.60) return "4";
      if (r > 0.30) return "3";
      return "2";
    };

    const results = [];
    for (let i = 0; i < count; i++) {
      const warrior   = pick(warriorPool);
      const rarity    = isSpecial ? rarityFromSpecial() : rarityFromRandom();
      const baseStats = ({
        "1": { hp: 60,  atk: 12, def: 10, spd: 10 },
        "2": { hp: 80,  atk: 15, def: 12, spd: 12 },
        "3": { hp: 100, atk: 20, def: 15, spd: 15 },
        "4": { hp: 130, atk: 28, def: 22, spd: 20 },
        "5": { hp: 180, atk: 40, def: 35, spd: 30 },
      } as any)[rarity] ?? { hp: 60, atk: 12, def: 10, spd: 10 };
      const growthBonus = isSpecial ? 1.25 : 1.0;
      results.push(await storage.createCompanion({
        userId, name: warrior.name, type: warrior.type, rarity,
        level: 1, experience: 0, expToNext: 100,
        hp:      Math.floor(baseStats.hp  * growthBonus),
        maxHp:   Math.floor(baseStats.hp  * growthBonus),
        attack:  Math.floor(baseStats.atk * growthBonus),
        defense: Math.floor(baseStats.def * growthBonus),
        speed:   Math.floor(baseStats.spd * growthBonus),
        skill: warrior.skill, isInParty: false, isSpecial: !!isSpecial,
      }));
    }
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ companions: results });
  });

  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const count     = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const locationId = Number(req.body?.locationId) || 1;

    // Fetch user + flags in parallel
    const [user, flagRows] = await Promise.all([
      storage.getUser(userId),
      storage.getPlayerFlags(userId),
    ]);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const totalCost = 15 * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, { rice: user.rice - totalCost });

    // Build flag map and derive story-unlocked pool (empty for flag-less players)
    const flagMap: Record<string, number> = {};
    for (const f of flagRows) flagMap[f.flagKey] = f.flagValue;
    const storyPool = getStoryUnlockedPool(flagMap);

    const weaponNames    = ["Masamune Katana","Muramasa Blade","Dragon Naginata","Shadow Tanto","Imperial Yari","Honjo Masamune","Kusanagi-no-Tsurugi","Onimaru","Mikazuki Munechika","Tombstone Cutter","Nihongo Spear","Otegine","Heshikiri Hasebe","Azai Ichimonji","Dragon Slaying Odachi"];
    const armorNames     = ["Oda Clan Do","Red Thread Kabuto","Shinobi Shozoku","Iron Suneate","Golden Menpo","Nanban-do Armor","Yukimura's Crimson Kabuto","Date's Crescent Helm","Dragon Scale Do","Golden Lacquer Hara-ate","Iron Menpo of Terror","Shogun's Great Armor","Shadow Stalker Garb"];
    const accessoryNames = ["Magatama of Luck","War Fan of Strategy","Ninja Kunai Set","Omamori of Health","Smoke Bomb Belt","Scroll of Hidden Mist","Sacred Mirror","Talisman of Elements","Vengeful Spirit Mask","Heirloom Inro","Dragon Bone Rosary","Jade Amulet","Phoenix Feather"];
    const horseGearNames = ["War Saddle","Iron Stirrups","Silk Reins","Steel Barding","Speed Spurs","Imperial Gold Saddle","Jade-Inlaid Stirrups","Wind-Step Horseshoes","Ceremonial Crest","Takeda War Banner","Thunder-Hoof Spurs","Celestial Bridle","Ebony Stirrups"];

    const results: any[] = [];
    for (let i = 0; i < count; i++) {

      // ── Story-drop gate ────────────────────────────────────────────────────────────
      // If the player has unlocked story items AND the random roll succeeds,
      // substitute this pull with a named historical piece.
      if (storyPool.length > 0 && Math.random() < STORY_DROP_CHANCE) {
        const def  = pick(storyPool);
        const payload = buildStoryEquipmentDrop(userId, def, locationId) as any;
        const eq   = await storage.createEquipment(payload);
        results.push({ ...eq, storyDrop: true, storyFlavour: def.storyFlavour });
        continue;
      }

      // ── Normal drop path (unchanged) ────────────────────────────────────────────
      const rDrop = Math.random();
      const type  = rDrop < 0.1 ? 'accessory' : pick(['weapon','armor','horse_gear']);
      const r     = Math.random();
      let rarity  = 'gold';
      if      (r > 0.94) rarity = 'celestial';
      else if (r > 0.88) rarity = 'transcendent';
      else if (r > 0.78) rarity = 'exotic';
      else if (r > 0.60) rarity = 'mythic';
      const name = pick(
        type === 'weapon' ? weaponNames : type === 'armor' ? armorNames :
        type === 'accessory' ? accessoryNames : horseGearNames
      );
      const statsByRarity: Record<string, { atk: number; def: number; spd: number }> = {
        gold:         { atk: 35,  def: 25,  spd: 15  },
        mythic:       { atk: 60,  def: 45,  spd: 25  },
        exotic:       { atk: 100, def: 75,  spd: 45  },
        transcendent: { atk: 200, def: 150, spd: 80  },
        celestial:    { atk: 450, def: 350, spd: 150 },
      };
      const base = statsByRarity[rarity] ?? statsByRarity.gold;
      let weaponType: string | null = null;
      if (type === 'weapon') {
        const lower = name.toLowerCase();
        if (lower.includes('bow')) weaponType = 'bow';
        else if (lower.includes('rod') || lower.includes('staff') || lower.includes('wand')) weaponType = 'staff';
        else if (lower.includes('knife') || lower.includes('cutter') || lower.includes('gauche')) weaponType = 'dagger';
        else weaponType = 'sword';
      }
      results.push(await storage.createEquipment({
        userId, name, type, weaponType, rarity,
        level: 1, experience: 0, expToNext: 100,
        attackBonus:  type === 'weapon'     || type === 'accessory' ? base.atk : 0,
        defenseBonus: type === 'armor'      || type === 'accessory' ? base.def : 0,
        speedBonus:   type === 'horse_gear' || type === 'accessory' ? base.spd : 0,
      }));
    }
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ equipment: results });
  });
}
