import {
  users, companions, equipment, pets, horses, transformations, campaignEvents, userQuests, cards,
  type User, type UpsertUser, type InsertCompanion, type InsertEquipment,
  type Companion, type Equipment, type Pet, type Horse, type Transformation,
  type InsertPet, type InsertHorse, type InsertTransformation, type CampaignEvent,
  type UserQuest, type Card, type InsertCard
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";

// ── Single source of truth for quest definitions ──────────────────────────────
export const QUEST_DEFINITIONS: Record<string, { goal: number; rewardType: string; amount: number }> = {
  daily_skirmish:       { goal: 5,  rewardType: "rice", amount: 50  },
  daily_boss:           { goal: 1,  rewardType: "rice", amount: 30  },
  daily_gacha:          { goal: 3,  rewardType: "rice", amount: 40  },
  daily_skirmish_elite: { goal: 10, rewardType: "rice", amount: 100 },
  daily_gacha_elite:    { goal: 5,  rewardType: "rice", amount: 80  },
};

const QUEST_POOL = Object.entries(QUEST_DEFINITIONS).map(([key, def]) => ({ key, ...def }));

// ── Base equipment catalogue (seeded once per user on first login) ────────────
const BASE_ITEMS: Omit<InsertEquipment, "userId">[] = [
  { name: "Knife",           type: "Weapon",        weaponType: "dagger", rarity: "white", level: 1,  attackBonus: 17, isEquipped: false },
  { name: "Cutter",          type: "Weapon",        weaponType: "dagger", rarity: "white", level: 1,  attackBonus: 28, isEquipped: false },
  { name: "Main Gauche",     type: "Weapon",        weaponType: "dagger", rarity: "white", level: 1,  attackBonus: 43, isEquipped: false },
  { name: "Sword",           type: "Weapon",        weaponType: "sword",  rarity: "white", level: 2,  attackBonus: 25, isEquipped: false },
  { name: "Falchion",        type: "Weapon",        weaponType: "sword",  rarity: "white", level: 2,  attackBonus: 39, isEquipped: false },
  { name: "Blade",           type: "Weapon",        weaponType: "sword",  rarity: "white", level: 2,  attackBonus: 53, isEquipped: false },
  { name: "Spear",           type: "Weapon",        weaponType: "spear",  rarity: "white", level: 2,  attackBonus: 37, isEquipped: false },
  { name: "Bow",             type: "Weapon",        weaponType: "bow",    rarity: "white", level: 1,  attackBonus: 15, isEquipped: false },
  { name: "Composite Bow",   type: "Weapon",        weaponType: "bow",    rarity: "white", level: 1,  attackBonus: 29, isEquipped: false },
  { name: "Great Bow",       type: "Weapon",        weaponType: "bow",    rarity: "white", level: 10, attackBonus: 43, isEquipped: false },
  { name: "Rod",             type: "Weapon",        weaponType: "staff",  rarity: "white", level: 1,  attackBonus: 15, matkBonus: 15, isEquipped: false },
  { name: "Wand",            type: "Weapon",        weaponType: "staff",  rarity: "white", level: 1,  attackBonus: 34, matkBonus: 15, isEquipped: false },
  { name: "Cotton Shirt",    type: "Armor",         rarity: "white", level: 1,  defenseBonus: 1, isEquipped: false },
  { name: "Jacket",          type: "Armor",         rarity: "white", level: 1,  defenseBonus: 2, isEquipped: false },
  { name: "Adventurer Suit", type: "Armor",         rarity: "white", level: 1,  defenseBonus: 3, isEquipped: false },
  { name: "Mantle",          type: "Armor",         rarity: "white", level: 1,  defenseBonus: 4, isEquipped: false },
  { name: "Coat",            type: "Armor",         rarity: "white", level: 14, defenseBonus: 5, isEquipped: false },
  { name: "Padded Armor",    type: "Armor",         rarity: "white", level: 14, defenseBonus: 6, isEquipped: false },
  { name: "Guard",           type: "Shield",        rarity: "white", level: 1,  defenseBonus: 3, isEquipped: false },
  { name: "Buckler",         type: "Shield",        rarity: "white", level: 14, defenseBonus: 4, isEquipped: false },
  { name: "Hood",            type: "Garment",       rarity: "white", level: 1,  defenseBonus: 1, isEquipped: false },
  { name: "Muffler",         type: "Garment",       rarity: "white", level: 14, defenseBonus: 2, isEquipped: false },
  { name: "Sandals",         type: "Footgear",      rarity: "white", level: 1,  defenseBonus: 1, isEquipped: false },
  { name: "Shoes",           type: "Footgear",      rarity: "white", level: 14, defenseBonus: 2, isEquipped: false },
  { name: "Novice Armlet",   type: "Accessory",     rarity: "white", level: 1,  hpBonus: 10, isEquipped: false },
  { name: "Ring",            type: "Accessory",     rarity: "white", level: 20, isEquipped: false },
  { name: "Brooch",          type: "Accessory",     rarity: "white", level: 20, isEquipped: false },
  { name: "Rosary",          type: "Accessory",     rarity: "white", level: 20, isEquipped: false },
  { name: "Bandana",         type: "HeadgearUpper", rarity: "white", level: 1,  defenseBonus: 1, isEquipped: false },
  { name: "Cap",             type: "HeadgearUpper", rarity: "white", level: 14, defenseBonus: 3, isEquipped: false },
  { name: "Ribbon",          type: "HeadgearUpper", rarity: "white", level: 1,  defenseBonus: 1, mdefBonus: 3, isEquipped: false },
  { name: "Glasses",         type: "HeadgearMiddle",rarity: "white", level: 1,  isEquipped: false },
  { name: "Flu Mask",        type: "HeadgearLower", rarity: "white", level: 1,  isEquipped: false },
];

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByAuthId(authUserId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;

  getCompanions(userId: string): Promise<Companion[]>;
  createCompanion(companion: InsertCompanion): Promise<Companion>;
  updateCompanion(id: number, updates: Partial<Companion>): Promise<Companion>;
  deleteCompanion(id: number): Promise<void>;
  /** Set isInParty=true for companions whose id is in companionIds, false for all others. */
  updateParty(userId: string, companionIds: number[]): Promise<void>;

  getEquipment(userId: string): Promise<(Equipment & { cards: Card[] })[]>;
  createEquipment(equip: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;

  getCards(userId: string): Promise<Card[]>;
  createCard(card: InsertCard): Promise<Card>;
  insertCardIntoEquipment(cardId: number, equipmentId: number): Promise<void>;

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
  recycleEquipment(userId: string): Promise<{ count: number; stonesGained: number }>;

  // Called once on first login — seeds base equipment for the user.
  syncBaseEquipment(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByAuthId(authUserId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUserId));
    return user;
  }

  /**
   * Upsert a user on Supabase login.
   *
   * Single-pass strategy:
   *   - Conflict on `auth_user_id` (unique) — always the stable Supabase identity.
   *   - If the row does not yet exist it is inserted.
   *   - Any genuine DB error (network, schema mismatch) is allowed to propagate
   *     so callers can see and handle it.
   *
   * After upsert, syncBaseEquipment is called if this is the user's first login
   * (i.e. no equipment exists yet), keeping the sync out of the hot read path.
   */
  async upsertUser(userData: UpsertUser): Promise<User> {
    const profileSet = {
      email:           userData.email,
      firstName:       userData.firstName,
      lastName:        userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      updatedAt:       new Date(),
    };

    // Single upsert keyed on the Supabase auth UUID (authUserId)
    await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.authUserId,
        set: profileSet,
      });

    // Re-fetch the canonical row
    const user =
      (await this.getUserByAuthId(userData.authUserId!)) ??
      (await this.getUser(userData.id!));

    if (!user) {
      throw new Error(
        `upsertUser: could not find or create user for authUserId=${userData.authUserId}`
      );
    }

    // Seed base equipment exactly once — on first login
    const existingEquipment = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.userId, user.id))
      .limit(1);

    if (existingEquipment.length === 0) {
      await this.syncBaseEquipment(user.id);
    }

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

  /**
   * Atomically updates the party roster for a user.
   * Step 1: clear isInParty for ALL of this user's companions.
   * Step 2: set isInParty = true for the supplied IDs (if any).
   * Passing an empty array simply clears the whole party.
   */
  async updateParty(userId: string, companionIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      // Clear entire party
      await tx
        .update(companions)
        .set({ isInParty: false })
        .where(eq(companions.userId, userId));

      // Set the new party members (skip if list is empty)
      if (companionIds.length > 0) {
        await tx
          .update(companions)
          .set({ isInParty: true })
          .where(
            and(
              eq(companions.userId, userId),
              inArray(companions.id, companionIds)
            )
          );
      }
    });
  }

  /**
   * Fetches all equipment for a user with their associated cards.
   * Uses 2 queries total (equipment + cards) instead of N+1.
   * syncBaseEquipment is NOT called here — it runs once in upsertUser.
   */
  async getEquipment(userId: string): Promise<(Equipment & { cards: Card[] })[]> {
    const items = await db.select().from(equipment).where(eq(equipment.userId, userId));
    if (items.length === 0) return [];

    // Single query for all cards belonging to this user's equipment
    const equipmentIds = items.map(i => i.id);
    const allCards = await db
      .select()
      .from(cards)
      .where(inArray(cards.equipmentId, equipmentIds));

    // Group cards by equipmentId in memory
    const cardMap = allCards.reduce<Record<number, Card[]>>((acc, card) => {
      if (card.equipmentId != null) {
        (acc[card.equipmentId] ??= []).push(card);
      }
      return acc;
    }, {});

    return items.map(item => ({ ...item, cards: cardMap[item.id] ?? [] }));
  }

  async createEquipment(equip: InsertEquipment): Promise<Equipment> {
    const [eqp] = await db.insert(equipment).values(equip).returning();
    return eqp;
  }

  async updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment> {
    const [eqp] = await db.update(equipment).set(updates).where(eq(equipment.id, id)).returning();
    return eqp;
  }

  async deleteEquipment(id: number): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  async getCards(userId: string): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.userId, userId));
  }

  async createCard(card: InsertCard): Promise<Card> {
    const [c] = await db.insert(cards).values(card as any).returning();
    return c;
  }

  async insertCardIntoEquipment(cardId: number, equipmentId: number): Promise<void> {
    const [eqp] = await db.select().from(equipment).where(eq(equipment.id, equipmentId));
    if (!eqp) throw new Error("Equipment not found");
    const existingCards = await db.select().from(cards).where(eq(cards.equipmentId, equipmentId));
    if (existingCards.length >= eqp.cardSlots) {
      throw new Error("No available card slots");
    }
    await db.update(cards).set({ equipmentId }).where(eq(cards.id, cardId));
  }

  async recycleEquipment(userId: string): Promise<{ count: number; stonesGained: number }> {
    return await db.transaction(async (tx) => {
      const conditions = [
        eq(equipment.userId, userId),
        eq(equipment.isEquipped, false)
      ];
      const targets = await tx.select().from(equipment).where(and(...conditions));
      if (targets.length === 0) return { count: 0, stonesGained: 0 };
      const stonesPerItem = 5;
      const totalStones = targets.length * stonesPerItem;
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

  /**
   * Returns today's quests for a user.
   * If no quests exist or they are from a previous day, rotates them inside
   * a single transaction to prevent partial-rotation corruption.
   */
  async getQuests(userId: string): Promise<UserQuest[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quests = await db.select().from(userQuests).where(eq(userQuests.userId, userId));

    const isOutdated =
      quests.length === 0 ||
      quests.some(q => {
        const lu = q.lastUpdated ? new Date(q.lastUpdated) : new Date(0);
        return lu < today;
      });

    if (!isOutdated) return quests;

    // Atomic rotation inside a transaction
    const selected = [...QUEST_POOL]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    await db.transaction(async (tx) => {
      await tx.delete(userQuests).where(eq(userQuests.userId, userId));
      await tx.insert(userQuests).values(
        selected.map(q => ({
          userId,
          questKey:    q.key,
          progress:    0,
          isClaimed:   false,
          lastUpdated: new Date(),
        }))
      );
    });

    return await db.select().from(userQuests).where(eq(userQuests.userId, userId));
  }

  async updateQuestProgress(userId: string, questKey: string, increment: number): Promise<void> {
    const quests = await this.getQuests(userId);
    const quest = quests.find(q => q.questKey === questKey);
    if (quest && !quest.isClaimed) {
      await db.update(userQuests)
        .set({ progress: (quest.progress || 0) + increment, lastUpdated: new Date() })
        .where(eq(userQuests.id, quest.id));
    }
  }

  async claimQuest(userId: string, questKey: string): Promise<{ success: boolean; reward?: string }> {
    const quests = await this.getQuests(userId);
    const quest  = quests.find(q => q.questKey === questKey);
    const user   = await this.getUser(userId);

    if (!quest || !user || quest.isClaimed) return { success: false };

    // Use the single QUEST_DEFINITIONS source of truth
    const def = QUEST_DEFINITIONS[questKey];
    if (!def || quest.progress < def.goal) return { success: false };

    await db.transaction(async (tx) => {
      await tx.update(userQuests).set({ isClaimed: true }).where(eq(userQuests.id, quest.id));
      const update: any = {};
      update[def.rewardType] = (user as any)[def.rewardType] + def.amount;
      await tx.update(users).set(update).where(eq(users.id, userId));
    });

    return { success: true, reward: `${def.amount} ${def.rewardType}` };
  }

  /**
   * Seeds the base equipment catalogue for a user.
   * Called ONCE during upsertUser (first login) — never on reads.
   * Still idempotent: skips items the user already owns by name.
   */
  async syncBaseEquipment(userId: string): Promise<void> {
    const existing     = await db.select({ name: equipment.name }).from(equipment).where(eq(equipment.userId, userId));
    const existingNames = new Set(existing.map(e => e.name));
    const toInsert      = BASE_ITEMS
      .filter(item => !existingNames.has(item.name))
      .map(item => ({ ...item, userId }));

    if (toInsert.length > 0) {
      await db.insert(equipment).values(toInsert);
    }
  }

  async restartGame(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    await db.transaction(async (tx) => {
      await tx.delete(companions).where(eq(companions.userId, userId));
      await tx.delete(equipment).where(eq(equipment.userId, userId));
      await tx.delete(pets).where(eq(pets.userId, userId));
      await tx.delete(horses).where(eq(horses.userId, userId));
      await tx.delete(transformations).where(eq(transformations.userId, userId));
      await tx.delete(campaignEvents).where(eq(campaignEvents.userId, userId));
      await tx.update(users).set({
        level: 1, experience: 0, gold: 0, rice: 100,
        hp: 100, maxHp: 100, attack: 10, defense: 10, speed: 10,
        str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1,
        statPoints: 48, stamina: 100, maxStamina: 100,
        currentLocationId: 1, activeTransformId: null, transformActiveUntil: null,
        upgradeStones: 0, seppukuCount: (user.seppukuCount || 0) + 1,
        permAttackBonus: 0, permDefenseBonus: 0, permSpeedBonus: 0, permHpBonus: 0,
        updatedAt: new Date()
      }).where(eq(users.id, userId));
    });
    await this.syncBaseEquipment(userId);
  }
}

export const storage = new DatabaseStorage();
