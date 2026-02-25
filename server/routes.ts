function getExpToNext(L: number): number {
    if (L < 11) return Math.floor(80 * Math.pow(L, 1.4));
    if (L < 71) return Math.floor(120 * Math.pow(L, 2));
    return Math.floor(150 * Math.pow(L, 2.4));
  }

const HORSE_RARITY_STATS: Record<string, { speed: number, atk: number, def: number }> = {
  white: { speed: 10, atk: 5, def: 5 },
  green: { speed: 20, atk: 15, def: 15 },
  blue: { speed: 35, atk: 30, def: 30 },
  purple: { speed: 60, atk: 50, def: 50 },
  gold: { speed: 100, atk: 85, def: 85 },
  mythic: { speed: 160, atk: 140, def: 140 },
  exotic: { speed: 240, atk: 210, def: 210 },
  transcendent: { speed: 340, atk: 300, def: 300 },
  celestial: { speed: 460, atk: 410, def: 410 },
  primal: { speed: 600, atk: 540, def: 540 }
};

function generateHorse(userId: string, locationId: number = 1) {
  const name = pick(HORSE_NAMES);
  const r = Math.random();
  const isChina = locationId >= 100;
  
  // Dynamic rarity scaling for horses based on location
  const bonus = isChina ? (locationId - 100) * 0.05 + 0.1 : (locationId - 1) * 0.02;
  
    let rarity = 'white';
    // Drops only up to 'purple' (LEGENDARY in UI)
    if (r > 0.95 - bonus) rarity = 'purple';
    else if (r > 0.80 - bonus) rarity = 'blue';
    else if (r > 0.55 - bonus) rarity = 'green';
    else rarity = 'white';

  const statsByRarity: Record<string, { speed: number, atk: number, def: number }> = {
    white: { speed: 10, atk: 5, def: 5 },
    green: { speed: 20, atk: 15, def: 15 },
    blue: { speed: 35, atk: 30, def: 30 },
    purple: { speed: 60, atk: 50, def: 50 },
    gold: { speed: 100, atk: 85, def: 85 },
    mythic: { speed: 160, atk: 140, def: 140 },
    exotic: { speed: 240, atk: 210, def: 210 },
    transcendent: { speed: 340, atk: 300, def: 300 },
    celestial: { speed: 460, atk: 410, def: 410 },
    primal: { speed: 600, atk: 540, def: 540 }
  };

  const stats = statsByRarity[rarity] || statsByRarity.white;
  const variance = () => (0.9 + Math.random() * 0.2); // 0.9 to 1.1 multiplier
  return {
    userId,
    name: `${rarity.toUpperCase()} ${name}`,
    rarity,
    level: 1,
    speedBonus: Math.floor(stats.speed * variance()),
    attackBonus: Math.floor(stats.atk * variance()),
    defenseBonus: Math.floor(stats.def * variance()),
    isActive: false
  };
}


function rarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.99) return "5";
  if (r > 0.90) return "4";
  if (r > 0.75) return "3";
  if (r > 0.50) return "2";
  return "1";
}

function equipRarityFromRandom(locationId: number = 1): string {
  const r = Math.random();
  const isChina = locationId >= 100;
  
  // Dynamic rarity scaling based on locationId
  // locationId 1 (Owari) -> base rates
  // locationId 2 (Mino) -> slightly better
  // ...
  // locationId 100+ (China) -> significantly better
  
  if (isChina) {
    const chinaIndex = locationId - 100;
    // China scaling: even more aggressive rarity improvements
    const bonus = chinaIndex * 0.02; // 2% shift per China map
    if (r > 0.985 - bonus) return 'celestial';
    if (r > 0.965 - bonus) return 'transcendent';
    if (r > 0.92 - bonus) return 'exotic';
    if (r > 0.80 - bonus) return 'mythic';
    if (r > 0.60 - bonus) return 'gold';
    if (r > 0.40 - bonus) return 'purple';
    if (r > 0.20 - bonus) return 'blue';
    if (r > 0.10 - bonus) return 'green';
    return 'white';
  }

  // Japan scaling: gradual improvement from map 1 to 6
  const japanBonus = (locationId - 1) * 0.03; // 3% shift per Japan map
  
  if (r > 0.995 - japanBonus/5) return 'celestial';     
  if (r > 0.985 - japanBonus/2) return 'transcendent';  
  if (r > 0.95 - japanBonus) return 'exotic';         
  if (r > 0.85 - japanBonus) return 'mythic';         
  if (r > 0.70 - japanBonus) return 'gold';           
  if (r > 0.50 - japanBonus) return 'purple';         
  if (r > 0.30 - japanBonus) return 'blue';           
  if (r > 0.15 - japanBonus) return 'green';          
  return 'white';                       
}

function calcEquipExpToNext(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

async function getPlayerTeamStats(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const comps = await storage.getCompanions(userId);
  const equips = await storage.getEquipment(userId);
  const allPets = await storage.getPets(userId);
  const allHorses = await storage.getHorses(userId);
  const allTransforms = await storage.getTransformations(userId);

  const partyCompanions = comps.filter(c => c.isInParty);
  const activePet = allPets.find(p => p.isActive);
  const activeHorse = allHorses.find(h => h.isActive);

    const playerEquipped = equips.filter(e => e.isEquipped && e.equippedToType === 'player');
    
    // Check for active transformation
    let activeTransform = null;
    if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
      activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
    }

    const totalAtkBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
    const totalDefBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
    const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);

    // Core stats (STR, AGI, VIT, INT, DEX, LUK)
    const STR = (user as any).str || 1;
    const AGI = (user as any).agi || 1;
    const VIT = (user as any).vit || 1;
    const INT = (user as any).int || 1;
    const DEX = (user as any).dex || 1;
    const LUK = (user as any).luk || 1;
    const BaseLv = user.level;

    // Derived Stats based on RO formulas
    // StatusATK: STR + floor(DEX / 5) + floor(LUK / 3)
    const statusATK = STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
    // StatusMATK: 1.5 * INT + floor(DEX / 5) + floor(LUK / 3)
    const statusMATK = Math.floor(1.5 * INT) + Math.floor(DEX / 5) + Math.floor(LUK / 3);
    
    // SoftDEF: floor(VIT / 2) + floor(AGI / 5)
    const softDEF = Math.floor(VIT / 2) + Math.floor(AGI / 5);
    // SoftMDEF: INT + floor(VIT / 5) + floor(DEX / 5)
    const softMDEF = INT + Math.floor(VIT / 5) + Math.floor(DEX / 5);

    // HIT: 175 + BaseLv + DEX + floor(LUK / 3)
    const hit = 175 + BaseLv + DEX + Math.floor(LUK / 3);
    // FLEE_A: 100 + BaseLv + AGI + floor(LUK / 5)
    const fleeA = 100 + BaseLv + AGI + Math.floor(LUK / 5);
    const perfectDodge = Math.floor(LUK / 10);
    const flee = fleeA + perfectDodge;

    // CRIT_rate: 0.3 * LUK
    const critRate = 0.3 * LUK;

    // Final calculations for the response
    let attack = user.attack + totalAtkBonus + (user.permAttackBonus || 0) + statusATK;
    let defense = user.defense + totalDefBonus + (user.permDefenseBonus || 0) + softDEF;
    let speed = user.speed + totalSpdBonus + (user.permSpeedBonus || 0) + Math.floor(AGI / 2); // Simplified ASPD influence
    
    // MaxHP = ClassBaseHP(BaseLv) * (1 + 0.01 * VIT) + gearHP
    // Using user.maxHp as ClassBaseHP
    let maxHp = Math.floor((user.maxHp + (user.permHpBonus || 0)) * (1 + 0.01 * VIT));
    let hp = Math.min(user.hp + (user.permHpBonus || 0), maxHp);
    
    // MaxSP = ClassBaseSP(BaseLv) * (1 + 0.01 * INT) + gearSP
    // Assuming base SP logic or adding to schema if needed, for now we use a derived value or just pass it
    const maxSp = Math.floor(100 * (1 + 0.01 * INT)); // Placeholder base SP 100

    // Apply transformation bonuses
    if (activeTransform) {
      attack = Math.floor(attack * (1 + activeTransform.attackPercent / 100));
      defense = Math.floor(defense * (1 + activeTransform.defensePercent / 100));
      speed = Math.floor(speed * (1 + activeTransform.speedPercent / 100));
      const hpBonus = Math.floor(maxHp * (activeTransform.hpPercent / 100));
      maxHp += hpBonus;
      hp += hpBonus;
    }

    // Aggregate stats
    const stats = {
      player: {
        name: user.firstName || user.lastName || 'Warrior',
        level: user.level,
        hp,
        maxHp,
        attack,
        defense,
        speed,
        str: STR,
        agi: AGI,
        vit: VIT,
        int: INT,
        dex: DEX,
        luk: LUK,
        strBonus: 0, // Placeholder for future gear/food bonuses
        agiBonus: 0,
        vitBonus: 0,
        intBonus: 0,
        dexBonus: 0,
        lukBonus: 0,
        statPoints: user.statPoints || 0,
        hit,
        flee,
        statusMATK,
        softMDEF,
        maxSp,
        critChance: playerEquipped.reduce((s, e) => s + (e.critChance || 0), 0) + Math.floor(critRate),
        critDamage: playerEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: playerEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        equipped: playerEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
        canTransform: allTransforms.length > 0,
        activeTransform: activeTransform ? {
          name: activeTransform.name,
          until: user.transformActiveUntil
        } : null,
        seppukuCount: user.seppukuCount || 0,
        permStats: {
          attack: user.permAttackBonus || 0,
          defense: user.permDefenseBonus || 0,
          speed: user.permSpeedBonus || 0,
          hp: user.permHpBonus || 0,
        }
      } as any,
    companions: partyCompanions.map(c => {
      const compEquipped = equips.filter(e => e.isEquipped && e.equippedToType === 'companion' && Number(e.equippedToId) === Number(c.id));
      const cAtkBonus = compEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
      const cDefBonus = compEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
      const cSpdBonus = compEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
      
      let cMaxHp = c.maxHp + Math.floor(c.maxHp * ((c as any).vit || 1) / 100);
      let cHp = Math.min(c.hp, cMaxHp);
      let cAttack = c.attack + cAtkBonus + ((c as any).str || 1);
      let cDefense = c.defense + cDefBonus + Math.floor(((c as any).vit || 1) / 2);
      let cSpeed = c.speed + cSpdBonus + Math.floor(((c as any).agi || 1) / 2);

      return {
        id: c.id,
        name: c.name,
        level: c.level,
        hp: cHp,
        maxHp: cMaxHp,
        attack: cAttack,
        defense: cDefense,
        speed: cSpeed,
        str: (c as any).str || 1,
        agi: (c as any).agi || 1,
        vit: (c as any).vit || 1,
        int: (c as any).int || 1,
        dex: (c as any).dex || 1,
        luk: (c as any).luk || 1,
        critChance: compEquipped.reduce((s, e) => s + (e.critChance || 0), 0) + Math.floor(((c as any).luk || 1) * 0.3),
        critDamage: compEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: compEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        skill: c.skill,
        equipped: compEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
      } as any;
    }),
    pet: activePet ? {
      name: activePet.name,
      level: activePet.level,
      hp: activePet.hp,
      maxHp: activePet.maxHp,
      attack: activePet.attack,
      defense: activePet.defense,
      speed: activePet.speed,
      skill: activePet.skill,
    } : null,
    horse: activeHorse ? {
      name: activeHorse.name,
      level: activeHorse.level,
      speedBonus: activeHorse.speedBonus,
      attackBonus: activeHorse.attackBonus,
      defenseBonus: activeHorse.defenseBonus || 0,
      skill: activeHorse.skill,
    } : null,
  };

  // Apply pet bonuses if active
  if (activePet) {
    const party = [stats.player, ...stats.companions];
    party.forEach(member => {
      member.attack += activePet.attack;
      member.defense += activePet.defense;
      member.speed += activePet.speed;
      member.maxHp += activePet.hp;
      member.hp += activePet.hp;
    });
  }

  // Apply horse bonuses to the whole party if active
  if (activeHorse) {
    const party = [stats.player, ...stats.companions];
    party.forEach(member => {
      if (activeHorse.speedBonus > 0) {
        member.speed = Math.floor(member.speed * (1 + activeHorse.speedBonus / 100));
      }
      if (activeHorse.attackBonus > 0) {
        member.attack = Math.floor(member.attack * (1 + activeHorse.attackBonus / 100));
      }
      if ((activeHorse.defenseBonus || 0) > 0) {
        member.defense = Math.floor(member.defense * (1 + (activeHorse.defenseBonus || 0) / 100));
      }
    });
  }

  return stats;
}

function generateEnemyStats(type: 'field' | 'boss' | 'special', playerLevel: number, locationId: number = 1) {
  let locationMultiplier = 1 + (locationId - 1) * 0.75;
  
  // China Region (locationId >= 100) has significantly higher scaling
  if (locationId >= 100) {
    const chinaIndex = locationId - 100;
    locationMultiplier = 5 + (chinaIndex * 2.5); // Start at 5x multiplier, grow by 2.5x per stage
  }

  if (type === 'field') {
    const isChina = locationId >= 100;
    const lvl = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
    
    // Data-driven monster definitions for early levels
    const monsterData: Record<number, { name: string, hp: number, atk: [number, number], def: number, exp: number, flee?: number }[]> = {
      1: [
        { name: "Slime", hp: 30, atk: [3, 5], def: 0, exp: 6 },
        { name: "Small Bat", hp: 40, atk: [4, 6], def: 0, exp: 8, flee: 10 },
        { name: "Baby Wolf", hp: 60, atk: [6, 8], def: 1, exp: 12 }
      ],
      2: [
        { name: "Field Poring", hp: 120, atk: [10, 14], def: 2, exp: 30 },
        { name: "Hornet", hp: 100, atk: [12, 16], def: 1, exp: 28, flee: 15 },
        { name: "Young Wolf", hp: 180, atk: [14, 18], def: 3, exp: 40 }
      ],
      3: [
        { name: "Forest Mushroom", hp: 220, atk: [18, 22], def: 4, exp: 80 },
        { name: "Forest Fox", hp: 200, atk: [20, 26], def: 2, exp: 90, flee: 20 },
        { name: "Stone Golem", hp: 350, atk: [22, 28], def: 8, exp: 140 }
      ]
    };

    const zone = Math.min(3, locationId);
    const possibleMonsters = monsterData[zone] || monsterData[1];
    const monster = pick(possibleMonsters);
    
    // Scaling for higher locations/levels not explicitly defined in the table
    let scale = 1.0;
    if (locationId > 3) {
      scale = Math.pow(1.3, locationId - 3);
    }
    if (isChina) scale *= 5;

    // Experience difference modifier
    const d = (monster.name === "Stone Golem" ? 13 : (zone === 1 ? 2 : zone === 2 ? 7 : 12)) - playerLevel;
    let expMod = 1.0;
    if (Math.abs(d) <= 5) expMod = 1.0;
    else if (d >= 6 && d <= 10) expMod = 1.1;
    else if (d >= 11) expMod = 1.2;
    else if (d <= -6 && d >= -10) expMod = 0.6;
    else if (d <= -11 && d >= -20) expMod = 0.3;
    else if (d <= -21) expMod = 0.1;

    return {
      name: monster.name,
      level: lvl,
      hp: Math.floor(monster.hp * scale),
      maxHp: Math.floor(monster.hp * scale),
      attack: Math.floor((pick(monster.atk) || 10) * scale),
      defense: Math.floor(monster.def * scale),
      speed: Math.floor((10 + (monster.flee || 0) + lvl * 2) * scale),
      exp: Math.floor(monster.exp * scale * expMod),
      skills: ["Scratch", "Bite"],
    };
  } else if (type === 'boss') {
    const name = locationId >= 100 ? pick(CN_BOSS_NAMES) : pick(JP_BOSS_NAMES);
    // Bosses scale more significantly with location
    // Added a more aggressive scaling for Japan maps (1-6) as well
    const difficultyMultiplier = locationId >= 100 
      ? (locationId - 100 + 5) * 3 
      : 1.5 + ((locationId - 1) * 0.8); // Starts at 1.5, grows by 0.8 per Japan map
    
    const lvl = locationId >= 100 
      ? Math.floor(playerLevel + 20 + ((locationId - 100) * 15)) 
      : Math.floor(playerLevel + 5 + (locationId * 6));
    
    return {
      name,
      level: lvl,
      hp: Math.floor((lvl * 150 + 500 + Math.floor(difficultyMultiplier * 1000)) * locationMultiplier),
      maxHp: Math.floor((lvl * 150 + 500 + Math.floor(difficultyMultiplier * 1000)) * locationMultiplier),
      attack: Math.floor((lvl * 25 + 60 + Math.floor(difficultyMultiplier * 50)) * locationMultiplier),
      defense: Math.floor((lvl * 20 + 50 + Math.floor(difficultyMultiplier * 40)) * locationMultiplier),
      speed: Math.floor((lvl * 12 + 25 + Math.floor(difficultyMultiplier * 20)) * locationMultiplier),
      skills: ["War Cry", "Shield Wall", "Charge", "Strategic Strike"],
    };
  } else {
    const sb = pick(SPECIAL_BOSSES);
    const name = locationId >= 100 ? "Celestial Dragon Emperor" : sb.name;
    // Special bosses are the ultimate challenge
    const difficultyMultiplier = locationId >= 100 ? (locationId - 100 + 10) * 5 : locationId;
    const lvl = locationId >= 100 ? Math.floor(playerLevel + 50 + ((locationId - 100) * 20)) : Math.floor(playerLevel + 15 + (locationId * 12));
    return {
      name,
      level: lvl,
      hp: Math.floor((lvl * 250 + 2000 + (difficultyMultiplier * 3000)) * locationMultiplier),
      maxHp: Math.floor((lvl * 250 + 2000 + (difficultyMultiplier * 3000)) * locationMultiplier),
      attack: Math.floor((lvl * 50 + 250 + (difficultyMultiplier * 150)) * locationMultiplier),
      defense: Math.floor((lvl * 40 + 200 + (difficultyMultiplier * 120)) * locationMultiplier),
      speed: Math.floor((lvl * 20 + 80 + (difficultyMultiplier * 50)) * locationMultiplier),
      skills: [sb.skill, "Roar", "Dark Aura", "Divine Intervention"],
    };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Player routes
  app.get(api.player.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json(user);
  });

  app.get(api.player.fullStatus.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(401).json({ message: "Unauthorized" });
    res.json(teamStats);
  });

  // Companions
  app.get(api.companions.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getCompanions(userId));
  });

  app.post(api.companions.setParty.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { companionIds } = req.body;
    if (!Array.isArray(companionIds) || companionIds.length > 5) {
      return res.status(400).json({ message: "Max 5 companions in party" });
    }
    const allComps = await storage.getCompanions(userId);
    
    // Check for duplicate names in the selected companion IDs
    const selectedComps = allComps.filter(c => companionIds.includes(c.id));
    const names = selectedComps.map(c => c.name);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      return res.status(400).json({ message: "Cannot deploy the same warrior twice" });
    }

    for (const comp of allComps) {
      const shouldBeInParty = companionIds.includes(comp.id);
      if (comp.isInParty !== shouldBeInParty) {
        await storage.updateCompanion(comp.id, { isInParty: shouldBeInParty });
      }
    }
    res.json(await storage.getCompanions(userId));
  });

  app.post(api.stats.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { stat } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const currentVal = (user as any)[stat] || 1;
    if (currentVal >= 99) return res.status(400).json({ message: "Stat already at maximum" });

    const cost = Math.floor((currentVal - 1) / 10) + 2;
    if ((user.statPoints || 0) < cost) {
      return res.status(400).json({ message: `Not enough stat points. Need ${cost}.` });
    }

    const updates: any = {
      statPoints: user.statPoints - cost,
      [stat]: currentVal + 1
    };

    const updatedUser = await storage.updateUser(userId, updates);
    res.json(updatedUser);
  });

  app.post(api.stats.bulkUpgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { upgrades } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let currentStatPoints = user.statPoints || 0;

        while (currentExp >= getExpToNext(currentLevel)) {
          const expReq = getExpToNext(currentLevel);
          currentExp -= expReq;
          currentStatPoints += Math.floor(currentLevel / 5) + 3;
          currentLevel++;
          currentMaxHp += 20;
          currentAtk += 5;
          currentDef += 3;
          currentSpd += 2;
        }

        await storage.updateUser(userId, { 
          level: currentLevel,
          experience: currentExp, 
        gold: user.gold + goldGained,
        endowmentStones: (user.endowmentStones || 0) + endowmentStones,
        transformationStones: (user.transformationStones || 0) + 10,
        maxHp: currentMaxHp,
        hp: currentMaxHp,
        attack: currentAtk,
        defense: currentDef,
        speed: currentSpd,
        statPoints: currentStatPoints
      });

      const sb = pick(SPECIAL_BOSSES);
      const trans = await storage.createTransformation({
        userId,
        name: sb.transformName,
        level: 1,
        experience: 0,
        expToNext: 200,
        attackPercent: sb.atkPct,
        defensePercent: sb.defPct,
        speedPercent: sb.spdPct,
        hpPercent: sb.hpPct,
        skill: sb.skill,
        cooldownSeconds: 60,
        durationSeconds: 30,
      });
      res.json({ victory: true, transformationDropped: trans, logs, experienceGained: expGained, goldGained: goldGained });
    } else {
      logs.push("Defeat!");
      res.json({ victory: false, logs });
    }
  });

  // Campaign Events
  app.get(api.campaign.events.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getCampaignEvents(userId));
  });

  app.post(api.campaign.triggerEvent.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { eventKey, choice } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const logs: string[] = [];
    let reward: any = null;

    if (eventKey === 'onin_war') {
      if (choice === 'nobunaga') {
        logs.push("You supported the Oda clan in Owari.");
        await storage.updateUser(userId, { gold: user.gold + 500 });
        reward = { type: 'gold', amount: 500 };
      } else {
        logs.push("You chose to walk your own path.");
      }
    } else if (eventKey === 'honnoji') {
        if (choice === 'rescue') {
            logs.push("You fought through the fire to save the Lord.");
            await storage.updateUser(userId, { attack: user.attack + 10 });
            reward = { type: 'stat', stat: 'attack', amount: 10 };
        } else {
            logs.push("You joined the rebellion. The course of history changes.");
        }
    } else if (eventKey === 'yokai_random') {
        if (choice === 'ally') {
            logs.push("You formed an alliance with the fox spirit.");
            reward = await storage.createPet({
                userId,
                name: "Heavenly Fox",
                type: "yokai",
                rarity: "gold",
                level: 1,
                experience: 0,
                expToNext: 100,
                hp: 50,
                maxHp: 50,
                attack: 15,
                defense: 10,
                speed: 25,
                skill: "Foxfire Ward",
                isActive: false
            });
        } else {
            logs.push("The spirit vanishes into the mist.");
        }
    }

    const event = await storage.createCampaignEvent({
      userId,
      eventKey,
      choice,
      isTriggered: true,
      completedAt: new Date(),
    });

    res.json({ event, logs, reward });
  });

  // Gacha
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const isSpecial = req.body?.isSpecial || false;
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const singleCost = isSpecial ? 50 : 10;
    const totalCost = singleCost * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, { rice: user.rice - totalCost });

    const warriorPool = [
      { name: "Oda Nobunaga", skill: "Demon King's Command", type: "General" },
      { name: "Toyotomi Hideyoshi", skill: "Ape's Cunning", type: "Strategist" },
      { name: "Tokugawa Ieyasu", skill: "Patient Turtle", type: "Defender" },
      { name: "Hattori Hanzo", skill: "Shadow Strike", type: "Ninja" },
      { name: "Sanada Yukimura", skill: "Crimson Charge", type: "Lancer" },
      { name: "Date Masamune", skill: "One-Eyed Dragon", type: "Ronin" },
      { name: "Uesugi Kenshin", skill: "God of War", type: "Monk" },
      { name: "Takeda Shingen", skill: "Furin-kazan", type: "General" },
      { name: "Miyamoto Musashi", skill: "Niten Ichi-ryu", type: "Samurai" },
      { name: "Sasaki Kojiro", skill: "Swallow Cut", type: "Samurai" },
      { name: "Honda Tadakatsu", skill: "Unscathed General", type: "Defender" },
      { name: "Akechi Mitsuhide", skill: "Tenka Fubu", type: "Tactician" }
    ];

    const results = [];
    for (let i = 0; i < count; i++) {
      const warrior = pick(warriorPool);
      
      const rarityFromSpecial = () => {
        const r = Math.random();
        if (r > 0.85) return "5"; // 15%
        if (r > 0.60) return "4"; // 25%
        if (r > 0.30) return "3"; // 30%
        return "2";               // 30% (No 1-star)
      };

      const rarity = isSpecial ? rarityFromSpecial() : rarityFromRandom();

      const baseStats = {
        "1": { hp: 60, atk: 12, def: 10, spd: 10 },
        "2": { hp: 80, atk: 15, def: 12, spd: 12 },
        "3": { hp: 100, atk: 20, def: 15, spd: 15 },
        "4": { hp: 130, atk: 28, def: 22, spd: 20 },
        "5": { hp: 180, atk: 40, def: 35, spd: 30 }
      }[rarity] || { hp: 60, atk: 12, def: 10, spd: 10 };

      const growthBonus = isSpecial ? 1.25 : 1.0;

      const companion = await storage.createCompanion({
        userId,
        name: warrior.name,
        type: warrior.type,
        rarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        hp: Math.floor(baseStats.hp * growthBonus),
        maxHp: Math.floor(baseStats.hp * growthBonus),
        attack: Math.floor(baseStats.atk * growthBonus),
        defense: Math.floor(baseStats.def * growthBonus),
        speed: Math.floor(baseStats.spd * growthBonus),
        skill: warrior.skill,
        isInParty: false,
        isSpecial: !!isSpecial,
      });
      results.push(companion);
    }
    
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ companions: results });
  });

  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const singleCost = 15;
    const totalCost = singleCost * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, { rice: user.rice - totalCost });
    
    const weaponNames = [
      "Masamune Katana", "Muramasa Blade", "Dragon Naginata", "Shadow Tanto", "Imperial Yari",
      "Honjo Masamune", "Kusanagi-no-Tsurugi", "Onimaru", "Mikazuki Munechika", "Tombstone Cutter",
      "Nihongo Spear", "Otegine", "Heshikiri Hasebe", "Azai Ichimonji", "Dragon Slaying Odachi"
    ];
    const armorNames = [
      "Oda Clan Do", "Red Thread Kabuto", "Shinobi Shozoku", "Iron Suneate", "Golden Menpo",
      "Nanban-do Armor", "Yukimura's Crimson Kabuto", "Date's Crescent Helm", "Dragon Scale Do",
      "Golden Lacquer Hara-ate", "Iron Menpo of Terror", "Shogun's Great Armor", "Shadow Stalker Garb"
    ];
    const accessoryNames = [
      "Magatama of Luck", "War Fan of Strategy", "Ninja Kunai Set", "Omamori of Health", "Smoke Bomb Belt",
      "Scroll of Hidden Mist", "Sacred Mirror", "Talisman of Elements", "Vengeful Spirit Mask",
      "Heirloom Inro", "Dragon Bone Rosary", "Jade Amulet", "Phoenix Feather"
    ];
    const horseGearNames = [
      "War Saddle", "Iron Stirrups", "Silk Reins", "Steel Barding", "Speed Spurs",
      "Imperial Gold Saddle", "Jade-Inlaid Stirrups", "Wind-Step Horseshoes", "Ceremonial Crest",
      "Takeda War Banner", "Thunder-Hoof Spurs", "Celestial Bridle", "Ebony Stirrups"
    ];

    const results = [];
    for (let i = 0; i < count; i++) {
      const rDrop = Math.random();
      let type: string;
      if (rDrop < 0.1) {
        type = 'accessory';
      } else {
        const others = ['weapon', 'armor', 'horse_gear'];
        type = others[Math.floor(Math.random() * others.length)];
      }
      
      const r = Math.random();
      let rarity = 'gold';
      if (r > 0.94) rarity = 'celestial';
      else if (r > 0.88) rarity = 'transcendent';
      else if (r > 0.78) rarity = 'exotic';
      else if (r > 0.60) rarity = 'mythic';
      else rarity = 'gold';

      const name = pick(
        type === 'weapon' ? weaponNames : 
        type === 'armor' ? armorNames : 
        type === 'accessory' ? accessoryNames : 
        horseGearNames
      );

      const statsByRarity: Record<string, { atk: number, def: number, spd: number }> = {
        gold: { atk: 35, def: 25, spd: 15 },
        mythic: { atk: 60, def: 45, spd: 25 },
        exotic: { atk: 100, def: 75, spd: 45 },
        transcendent: { atk: 200, def: 150, spd: 80 },
        celestial: { atk: 450, def: 350, spd: 150 }
      };
      const baseStats = statsByRarity[rarity] || statsByRarity.gold;
      
      let atkBonus = type === 'weapon' || type === 'accessory' ? baseStats.atk : 0;
      let defBonus = type === 'armor' || type === 'accessory' ? baseStats.def : 0;
      let spdBonus = type === 'horse_gear' || type === 'accessory' ? baseStats.spd : 0;

      const equipment = await storage.createEquipment({
        userId,
        name,
        type,
        rarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        attackBonus: atkBonus,
        defenseBonus: defBonus,
        speedBonus: spdBonus,
      });
      results.push(equipment);
    }
    
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ equipment: results });
  });

  app.post("/api/player/exchange-stones", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const riceCost = 2000;
    if (user.rice < riceCost) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, {
      rice: user.rice - riceCost,
      endowmentStones: (user.endowmentStones || 0) + 1
    });
    
    res.json({ success: true });
  });

  app.post("/api/equipment/:id/endow", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { type, protect } = req.body; // type: 'normal', 'advanced', 'extreme'
    
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const equips = await storage.getEquipment(userId);
    const eq = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });

    if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });

    // Success Rates: Base 90% - (CurrentPoints * 2%)
    const currentPoints = eq.endowmentPoints || 0;
    const baseRate = type === 'extreme' ? 0.7 : 0.9;
    const successRate = Math.max(0.1, baseRate - (currentPoints * 0.02));
    const roll = Math.random();
    
    let pointsGained = 0;
    let failed = false;

    if (roll < successRate) {
      if (type === 'advanced') {
        const advRoll = Math.random();
        if (advRoll < 0.1) pointsGained = 5;
        else if (advRoll < 0.25) pointsGained = 4;
        else if (advRoll < 0.45) pointsGained = 3;
        else if (advRoll < 0.70) pointsGained = 2;
        else pointsGained = 1;
      } else {
        pointsGained = 1;
      }
    } else {
      failed = true;
      const talismanField = type === 'extreme' ? 'flameEmperorTalisman' : 'fireGodTalisman';
      const hasTalisman = user[talismanField as keyof typeof user] as number > 0;
      
      if (protect && hasTalisman) {
        pointsGained = 0;
        await storage.updateUser(userId, { [talismanField]: (user[talismanField as keyof typeof user] as number) - 1 });
      } else {
        pointsGained = -Math.floor(Math.random() * 5) - 1;
      }
    }

    const newPoints = Math.max(0, Math.min(70, currentPoints + pointsGained));
    
    await storage.updateUser(userId, { endowmentStones: user.endowmentStones - 1 });
    const updated = await storage.updateEquipment(eq.id, { endowmentPoints: newPoints });

    res.json({ 
      success: !failed, 
      pointsGained, 
      newPoints,
      equipment: updated
    });
  });

  app.post(api.restart.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    res.json({ success: true });
  });

  app.get('/api/quests', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const quests = await storage.getQuests(userId);
    const QUEST_DEFS_POOL: Record<string, { name: string, desc: string, goal: number, reward: string }> = {
      'daily_skirmish': { name: 'Daily Skirmisher', desc: 'Win 5 skirmishes', goal: 5, reward: '50 Rice' },
      'daily_boss': { name: 'Giant Slayer', desc: 'Defeat a boss', goal: 1, reward: '30 Rice' },
      'daily_gacha': { name: 'Summoner', desc: 'Perform 3 summons', goal: 3, reward: '40 Rice' },
      'daily_skirmish_elite': { name: 'Elite Skirmisher', desc: 'Win 10 skirmishes', goal: 10, reward: '100 Rice' },
      'daily_gacha_elite': { name: 'Elite Summoner', desc: 'Perform 5 summons', goal: 5, reward: '80 Rice' }
    };
    
    const status = quests.map(q => {
      const def = QUEST_DEFS_POOL[q.questKey] || { name: 'Unknown Quest', desc: 'Unknown', goal: 1, reward: 'Unknown' };
      return {
        ...def,
        key: q.questKey,
        progress: q.progress,
        isClaimed: q.isClaimed
      };
    });
    
    res.json(status);
  });

  app.post('/api/quests/:key/claim', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const result = await storage.claimQuest(userId, req.params.key);
    res.json(result);
  });

  return httpServer;
}
