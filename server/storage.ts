import {
  users, companions, equipment, pets, horses, transformations, campaignEvents, userQuests, cards,
  playerStoryGrants, storyGrants,
  type User, type UpsertUser, type InsertCompanion, type InsertEquipment,
  type Companion, type Equipment, type Pet, type Horse, type Transformation,
  type InsertPet, type InsertHorse, type InsertTransformation, type CampaignEvent,
  type UserQuest, type Card, type InsertCard,
  type PlayerStoryGrant, type InsertPlayerStoryGrant,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";

// ── Single source of truth for starting stats ─────────────────────────────────────────
// These MUST mirror the defaults in schema.ts and migration 0003.
// Used by restartGame() so a Seppuku reset lands on the same values
// as a brand-new account.
export const STARTING_STATS = {
  level:     1,
  experience: 0,
  gold:      500,
  rice:      100,
  hp:        200,
  maxHp:     200,
  attack:    30,
  defense:   20,
  speed:     10,
  str:       10,
  agi:       10,
  vit:       10,
  int:       10,
  dex:       10,
  luk:       10,
  stamina:   100,
  maxStamina: 100,
  statPoints: 48,
} as const;

// ── Single source of truth for quest definitions ─────────────────────────────────────────
export const QUEST_DEFINITIONS: Record<string, { goal: number; rewardType: string; amount: number }> = {
  daily_skirmish:       { goal: 5,  rewardType: "rice", amount: 50  },
  daily_boss:           { goal: 1,  rewardType: "rice", amount: 30  },
  daily_gacha:          { goal: 3,  rewardType: "rice", amount: 40  },
  daily_skirmish_elite: { goal: 10, rewardType: "rice", amount: 100 },
  daily_gacha_elite:    { goal: 5,  rewardType: "rice", amount: 80  },
};

const QUEST_POOL = Object.entries(QUEST_DEFINITIONS).map(([key, def]) => ({ key, ...def }));

// ── Base equipment catalogue (seeded once per user on first login) ──────────────────
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

// ──────────────────────────────────────────────────────────────────────────────────
// Story-grant view type (Part 6/10)
// ──────────────────────────────────────────────────────────────────────────────────
//
// Shared between IStorage and the REST layer so callers don’t need to import
// from grant-evaluator.ts directly.

export interface StorageGrantView {
  /** Auto-increment PK from player_story_grants */
  id:               number;
  /** Stable key from story_grants catalogue */
  grantKey:         string;
  /** Human-readable label (from story_grants) */
  displayName:      string;
  /** Flavour sentence shown in the Chronicle Wall and reward popup */
  flavourText:      string | null;
  /** "companion" | "equipment" | "pet" | "horse" */
  grantCategory:    string;
  /** Rarity from the payload: "uncommon" | "rare" | "epic" | "legendary" */
  rarity:           string;
  /** DB id of the game-table row that was created when this grant was issued */
  gameRowId:        number | null;
  /** True when a newer tier has superseded this grant (upgrade chain) */
  isSuperseded:     boolean;
  /** chapterOrder at which the grant was awarded */
  awardedAtChapter: number;
  /** Wall-clock timestamp of the award */
  awardedAt:        Date;
}

// ── IStorage interface ───────────────────────────────────────────────────────────────────

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByAuthId(authUserId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;

  getCompanions(userId: string): Promise<Companion[]>;
  createCompanion(companion: InsertCompanion): Promise<Companion>;
  updateCompanion(id: number, updates: Partial<Companion>): Promise<Companion>;
  deleteCompanion(id: number): Promise<void>;
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

  syncBaseEquipment(userId: string): Promise<void>;

  // ── Story grant helpers (Part 6/10) ──────────────────────────────────────────────
  //
  // getPlayerGrants  — read-only list of all grants issued to a player,
  //                    joined with catalogue displayName / flavourText / rarity.
  //                    Used by GET /api/story/grants and the Chronicle Wall.
  //
  // awardGrant       — low-level write helper for external callers that need to
  //                    issue a grant outside the normal evaluateGrants() path
  //                    (e.g. admin tools, test harnesses, special events).
  //                    Idempotent: silently returns the existing row if the
  //                    grant has already been issued.

  getPlayerGrants(userId: string): Promise<StorageGrantView[]>;

  awardGrant(
    userId:      string,
    grantKey:    string,
    gameRowId:   number | null,
    chapterNum:  number,
    flagSnapshot: Record<string, number>,
  ): Promise<{ granted: boolean; row: PlayerStoryGrant }>;
}

// ── DatabaseStorage ─────────────────────────────────────────────────────────────────────

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

  async upsertUser(userData: UpsertUser): Promise<User> {
    const profileSet = {
      email:           userData.email,
      firstName:       userData.firstName,
      lastName:        userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      updatedAt:       new Date(),
    };

    await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.authUserId,
        set: profileSet,
      });

    const user =
      (await this.getUserByAuthId(userData.authUserId!)) ??
      (await this.getUser(userData.id!));

    if (!user) {
      throw new Error(
        `upsertUser: could not find or create user for authUserId=${userData.authUserId}`
      );
    }

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

  async updateParty(userId: string, companionIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(companions)
        .set({ isInParty: false })
        .where(eq(companions.userId, userId));

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

  async getEquipment(userId: string): Promise<(Equipment & { cards: Card[] })[]> {
    const items = await db.select().from(equipment).where(eq(equipment.userId, userId));
    if (items.length === 0) return [];

    const equipmentIds = items.map(i => i.id);
    const allCards = await db
      .select()
      .from(cards)
      .where(inArray(cards.equipmentId, equipmentIds));

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

  async syncBaseEquipment(userId: string): Promise<void> {
    const existing      = await db.select({ name: equipment.name }).from(equipment).where(eq(equipment.userId, userId));
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
        // Use STARTING_STATS so this always stays in sync with schema.ts.
        level:             STARTING_STATS.level,
        experience:        STARTING_STATS.experience,
        gold:              STARTING_STATS.gold,
        rice:              STARTING_STATS.rice,
        hp:                STARTING_STATS.hp,
        maxHp:             STARTING_STATS.maxHp,
        attack:            STARTING_STATS.attack,
        defense:           STARTING_STATS.defense,
        speed:             STARTING_STATS.speed,
        str:               STARTING_STATS.str,
        agi:               STARTING_STATS.agi,
        vit:               STARTING_STATS.vit,
        int:               STARTING_STATS.int,
        dex:               STARTING_STATS.dex,
        luk:               STARTING_STATS.luk,
        stamina:           STARTING_STATS.stamina,
        maxStamina:        STARTING_STATS.maxStamina,
        statPoints:        STARTING_STATS.statPoints,
        currentLocationId: 1,
        activeTransformId:   null,
        transformActiveUntil: null,
        upgradeStones:     0,
        seppukuCount:      (user.seppukuCount || 0) + 1,
        permAttackBonus:   0,
        permDefenseBonus:  0,
        permSpeedBonus:    0,
        permHpBonus:       0,
        updatedAt:         new Date(),
      }).where(eq(users.id, userId));
    });
    await this.syncBaseEquipment(userId);
  }

  // ──────────────────────────────────────────────────────────────────────────────────
  // Story grant helpers (Part 6/10)
  // ──────────────────────────────────────────────────────────────────────────────────

  /**
   * Return all story grants issued to a player, enriched with catalogue
   * display metadata (displayName, flavourText, rarity) via a single JOIN.
   *
   * Design note: this is intentionally the ONLY method in storage.ts that
   * performs a JOIN.  It is acceptable here because the join is read-only,
   * always keyed by a unique index (user_id), and the result set is small
   * (max ~26 rows per player for the full Ch3–8 run).  All writes still go
   * through single-table helpers.
   */
  async getPlayerGrants(userId: string): Promise<StorageGrantView[]> {
    const rows = await db
      .select({
        id:               playerStoryGrants.id,
        grantKey:         playerStoryGrants.grantKey,
        displayName:      storyGrants.displayName,
        flavourText:      storyGrants.flavourText,
        grantCategory:    playerStoryGrants.grantCategory,
        grantPayload:     storyGrants.grantPayload,
        gameRowId:        playerStoryGrants.gameRowId,
        isSuperseded:     playerStoryGrants.isSuperseded,
        awardedAtChapter: playerStoryGrants.awardedAtChapter,
        awardedAt:        playerStoryGrants.awardedAt,
      })
      .from(playerStoryGrants)
      .innerJoin(
        storyGrants,
        eq(playerStoryGrants.grantKey, storyGrants.grantKey),
      )
      .where(eq(playerStoryGrants.userId, userId));

    return rows.map((r) => ({
      id:               r.id,
      grantKey:         r.grantKey,
      displayName:      r.displayName,
      flavourText:      r.flavourText ?? null,
      grantCategory:    r.grantCategory,
      // Extract rarity from the JSONB payload — all four payload shapes
      // have a top-level `rarity` string field.
      rarity:           (r.grantPayload as { rarity?: string })?.rarity ?? "common",
      gameRowId:        r.gameRowId,
      isSuperseded:     r.isSuperseded,
      awardedAtChapter: r.awardedAtChapter,
      awardedAt:        r.awardedAt,
    }));
  }

  /**
   * Low-level grant issuance helper.
   *
   * Inserts a player_story_grants row and marks the base grant as superseded
   * when the catalogue row has an `upgradeOf` key pointing to a previously
   * issued grant.
   *
   * Idempotent: if the grantKey is already owned by this user, returns
   * { granted: false, row: existingRow } without writing anything.
   *
   * This method does NOT create the companion / equipment / pet / horse row.
   * That is the caller’s responsibility (or use evaluateGrants() which handles
   * the full flow end-to-end).
   */
  async awardGrant(
    userId:      string,
    grantKey:    string,
    gameRowId:   number | null,
    chapterNum:  number,
    flagSnapshot: Record<string, number>,
  ): Promise<{ granted: boolean; row: PlayerStoryGrant }> {
    // Idempotency check — single indexed read.
    const [existing] = await db
      .select()
      .from(playerStoryGrants)
      .where(
        and(
          eq(playerStoryGrants.userId, userId),
          eq(playerStoryGrants.grantKey, grantKey),
        ),
      )
      .limit(1);

    if (existing) {
      return { granted: false, row: existing };
    }

    // Resolve grantCategory from the catalogue so the caller doesn’t need
    // to pass it explicitly — it’s a static property of the grant definition.
    const [catalogueRow] = await db
      .select({
        grantCategory: storyGrants.grantCategory,
        upgradeOf:     storyGrants.upgradeOf,
      })
      .from(storyGrants)
      .where(eq(storyGrants.grantKey, grantKey))
      .limit(1);

    if (!catalogueRow) {
      throw new Error(
        `awardGrant: grantKey "${grantKey}" not found in story_grants catalogue. ` +
        `Run seedStoryGrants() first.`,
      );
    }

    // Insert the player award row.
    const [inserted] = await db
      .insert(playerStoryGrants)
      .values({
        userId,
        grantKey,
        gameRowId,
        grantCategory:    catalogueRow.grantCategory,
        isSuperseded:     false,
        awardedAtChapter: chapterNum,
        flagSnapshot:     flagSnapshot as unknown as Record<string, unknown>,
      })
      .returning();

    // Mark the base grant as superseded if this is a tier upgrade.
    if (catalogueRow.upgradeOf) {
      await db
        .update(playerStoryGrants)
        .set({ isSuperseded: true })
        .where(
          and(
            eq(playerStoryGrants.userId, userId),
            eq(playerStoryGrants.grantKey, catalogueRow.upgradeOf),
          ),
        );
    }

    return { granted: true, row: inserted };
  }
}

export const storage = new DatabaseStorage();
