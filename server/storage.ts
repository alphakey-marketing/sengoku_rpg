import {
  users, companions, equipment, pets, horses, transformations, campaignEvents, userQuests,
  type User, type UpsertUser, type InsertCompanion, type InsertEquipment,
  type Companion, type Equipment, type Pet, type Horse, type Transformation,
  type InsertPet, type InsertHorse, type InsertTransformation, type CampaignEvent,
  type UserQuest
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;

  getCompanions(userId: string): Promise<Companion[]>;
  createCompanion(companion: InsertCompanion): Promise<Companion>;
  updateCompanion(id: number, updates: Partial<Companion>): Promise<Companion>;
  deleteCompanion(id: number): Promise<void>;

  getEquipment(userId: string): Promise<Equipment[]>;
  createEquipment(equip: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;

  getPets(userId: string): Promise<Pet[]>;
  createPet(pet: InsertPet): Promise<Pet>;
  updatePet(id: number, updates: Partial<Pet>): Promise<Pet>;
  deletePet(id: number): Promise<void>;

  getHorses(userId: string): Promise<Horse[]>;
  getHorse(id: number): Promise<Horse | undefined>;
  createHorse(horse: InsertHorse): Promise<Horse>;
  updateHorse(id: number, updates: Partial<Horse>): Promise<Horse>;
  deleteHorse(id: number): Promise<void>;

  getTransformations(userId: string): Promise<Transformation[]>;
  createTransformation(t: InsertTransformation): Promise<Transformation>;
  updateTransformation(id: number, updates: Partial<Transformation>): Promise<Transformation>;

  getQuests(userId: string): Promise<UserQuest[]>;
  updateQuestProgress(userId: string, questKey: string, increment: number): Promise<void>;
  claimQuest(userId: string, questKey: string): Promise<{ success: boolean; reward?: string }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getCompanions(userId: string): Promise<Companion[]> {
    return await db.select().from(companions).where(eq(companions.userId, userId));
  }

  async createCompanion(companion: InsertCompanion): Promise<Companion> {
    const [comp] = await db.insert(companions).values(companion as any).returning();
    return comp;
  }

  async updateCompanion(id: number, updates: Partial<Companion>): Promise<Companion> {
    const [comp] = await db.update(companions).set(updates).where(eq(companions.id, id)).returning();
    return comp;
  }

  async deleteCompanion(id: number): Promise<void> {
    await db.delete(companions).where(eq(companions.id, id));
  }

  async getEquipment(userId: string): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.userId, userId));
  }

  async createEquipment(equip: InsertEquipment): Promise<Equipment> {
    const [eqp] = await db.insert(equipment).values(equip as any).returning();
    return eqp;
  }

  async updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment> {
    const [eqp] = await db.update(equipment).set(updates).where(eq(equipment.id, id)).returning();
    return eqp;
  }

  async deleteEquipment(id: number): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  async recycleEquipmentByRarity(userId: string, rarity: string): Promise<{ count: number; stonesGained: number }> {
    const rarityStones: Record<string, number> = { 
      white: 1, green: 2, blue: 3, purple: 5, gold: 10,
      mythic: 20, exotic: 40, transcendent: 80, celestial: 150, primal: 300
    };
    
    return await db.transaction(async (tx) => {
      const conditions = [
        eq(equipment.userId, userId),
        eq(equipment.isEquipped, false)
      ];
      
      if (rarity !== 'all') {
        conditions.push(eq(equipment.rarity, rarity));
      }
      
      const targets = await tx.select().from(equipment).where(and(...conditions));
      
      if (targets.length === 0) return { count: 0, stonesGained: 0 };
      
      const totalStones = targets.reduce((sum, item) => sum + (rarityStones[item.rarity] || 1), 0);
      
      await tx.delete(equipment).where(and(...conditions));
      
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (user) {
        await tx.update(users)
          .set({ upgradeStones: (user.upgradeStones || 0) + totalStones })
          .where(eq(users.id, userId));
      }
      
      return { count: targets.length, stonesGained: totalStones };
    });
  }

  async getPets(userId: string): Promise<Pet[]> {
    return await db.select().from(pets).where(eq(pets.userId, userId));
  }

  async createPet(pet: InsertPet): Promise<Pet> {
    const [p] = await db.insert(pets).values(pet as any).returning();
    return p;
  }

  async updatePet(id: number, updates: Partial<Pet>): Promise<Pet> {
    const [p] = await db.update(pets).set(updates).where(eq(pets.id, id)).returning();
    return p;
  }

  async deletePet(id: number): Promise<void> {
    await db.delete(pets).where(eq(pets.id, id));
  }

  async getHorses(userId: string): Promise<Horse[]> {
    return await db.select().from(horses).where(eq(horses.userId, userId));
  }

  async getHorse(id: number): Promise<Horse | undefined> {
    const [horse] = await db.select().from(horses).where(eq(horses.id, id));
    return horse;
  }

  async createHorse(horse: InsertHorse): Promise<Horse> {
    const [h] = await db.insert(horses).values(horse as any).returning();
    return h;
  }

  async updateHorse(id: number, updates: Partial<Horse>): Promise<Horse> {
    const [h] = await db.update(horses).set(updates).where(eq(horses.id, id)).returning();
    return h;
  }

  async deleteHorse(id: number): Promise<void> {
    await db.delete(horses).where(eq(horses.id, id));
  }

  async getTransformations(userId: string): Promise<Transformation[]> {
    return await db.select().from(transformations).where(eq(transformations.userId, userId));
  }

  async createTransformation(t: InsertTransformation): Promise<Transformation> {
    const [tr] = await db.insert(transformations).values(t as any).returning();
    return tr;
  }

  async updateTransformation(id: number, updates: Partial<Transformation>): Promise<Transformation> {
    const [tr] = await db.update(transformations).set(updates).where(eq(transformations.id, id)).returning();
    return tr;
  }

  async getCampaignEvents(userId: string): Promise<CampaignEvent[]> {
    return await db.select().from(campaignEvents).where(eq(campaignEvents.userId, userId));
  }

  async createCampaignEvent(insertEvent: any): Promise<CampaignEvent> {
    const [event] = await db.insert(campaignEvents).values(insertEvent).returning();
    return event;
  }

  async getQuests(userId: string): Promise<UserQuest[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Auto-reset quests if they are from a previous day
    const quests = await db.select().from(userQuests).where(eq(userQuests.userId, userId));
    
    // If no quests exist or they are from a previous day, generate new ones
    const isOutdated = quests.length === 0 || quests.some(q => {
      const lu = q.lastUpdated ? new Date(q.lastUpdated) : new Date(0);
      return lu < today;
    });

    if (isOutdated) {
      const QUEST_POOL = [
        { key: 'daily_skirmish', goal: 5, rewardType: 'rice', amount: 50 },
        { key: 'daily_boss', goal: 1, rewardType: 'rice', amount: 30 },
        { key: 'daily_gacha', goal: 3, rewardType: 'rice', amount: 40 },
        { key: 'daily_skirmish_elite', goal: 10, rewardType: 'rice', amount: 100 },
        { key: 'daily_gacha_elite', goal: 5, rewardType: 'rice', amount: 80 }
      ];
      
      // Select 3 random quests
      const selected = [...QUEST_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);
      
      await db.delete(userQuests).where(eq(userQuests.userId, userId));
      
      for (const q of selected) {
        await db.insert(userQuests).values({
          userId,
          questKey: q.key,
          progress: 0,
          isClaimed: false,
          lastUpdated: new Date()
        });
      }
      return await db.select().from(userQuests).where(eq(userQuests.userId, userId));
    }

    return quests;
  }

  async updateQuestProgress(userId: string, questKey: string, increment: number): Promise<void> {
    const quests = await this.getQuests(userId);
    const quest = quests.find(q => q.questKey === questKey);
    
    if (quest) {
      if (!quest.isClaimed) {
        await db.update(userQuests)
          .set({ progress: (quest.progress || 0) + increment, lastUpdated: new Date() })
          .where(eq(userQuests.id, quest.id));
      }
    } else {
      // If quest doesn't exist in the active set but we're trying to update it,
      // it might be a quest not selected for today, so we ignore it or 
      // we could proactively insert it. Given the current design, we only
      // update if it was one of the 3 selected quests.
    }
  }

  async claimQuest(userId: string, questKey: string): Promise<{ success: boolean; reward?: string }> {
    const quests = await this.getQuests(userId);
    const quest = quests.find(q => q.questKey === questKey);
    const user = await this.getUser(userId);

    if (!quest || !user || quest.isClaimed) return { success: false };

    const QUEST_DEFS_LOOKUP: Record<string, { goal: number, rewardType: string, amount: number }> = {
      'daily_skirmish': { goal: 5, rewardType: 'rice', amount: 50 },
      'daily_boss': { goal: 1, rewardType: 'rice', amount: 30 },
      'daily_gacha': { goal: 3, rewardType: 'rice', amount: 40 },
      'daily_skirmish_elite': { goal: 10, rewardType: 'rice', amount: 100 },
      'daily_gacha_elite': { goal: 5, rewardType: 'rice', amount: 80 }
    };

    const def = QUEST_DEFS_LOOKUP[questKey];
    if (!def || quest.progress < def.goal) return { success: false };

    await db.transaction(async (tx) => {
      await tx.update(userQuests).set({ isClaimed: true }).where(eq(userQuests.id, quest.id));
      const update: any = {};
      update[def.rewardType] = (user as any)[def.rewardType] + def.amount;
      await tx.update(users).set(update).where(eq(users.id, userId));
    });

    return { success: true, reward: `${def.amount} ${def.rewardType}` };
  }

  async restartGame(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    // Calculate bonuses: 10% of current stats added to permanent pool
    const bonusAtk = Math.floor(user.attack * 0.1);
    const bonusDef = Math.floor(user.defense * 0.1);
    const bonusSpd = Math.floor(user.speed * 0.1);
    const bonusHp = Math.floor(user.maxHp * 0.1);

    await db.transaction(async (tx) => {
      await tx.delete(companions).where(eq(companions.userId, userId));
      await tx.delete(equipment).where(eq(equipment.userId, userId));
      await tx.delete(pets).where(eq(pets.userId, userId));
      await tx.delete(horses).where(eq(horses.userId, userId));
      await tx.delete(transformations).where(eq(transformations.userId, userId));
      await tx.delete(campaignEvents).where(eq(campaignEvents.userId, userId));
      await tx.update(users).set({
        level: 1,
        experience: 0,
        gold: 0,
        rice: 100,
        hp: 100,
        maxHp: 100,
        attack: 10,
        defense: 10,
        speed: 10,
        str: 1,
        agi: 1,
        vit: 1,
        int: 1,
        dex: 1,
        luk: 1,
        stamina: 100,
        maxStamina: 100,
        currentLocationId: 1,
        activeTransformId: null,
        upgradeStones: 0,
        seppukuCount: (user.seppukuCount || 0) + 1,
        permAttackBonus: (user.permAttackBonus || 0) + bonusAtk,
        permDefenseBonus: (user.permDefenseBonus || 0) + bonusDef,
        permSpeedBonus: (user.permSpeedBonus || 0) + bonusSpd,
        permHpBonus: (user.permHpBonus || 0) + bonusHp,
        updatedAt: new Date()
      }).where(eq(users.id, userId));
    });
  }
}

export const storage = new DatabaseStorage();
