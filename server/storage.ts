import {
  users, companions, equipment, pets, horses, transformations, campaignEvents,
  type User, type UpsertUser, type InsertCompanion, type InsertEquipment,
  type Companion, type Equipment, type Pet, type Horse, type Transformation,
  type InsertPet, type InsertHorse, type InsertTransformation, type CampaignEvent
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
  createHorse(horse: InsertHorse): Promise<Horse>;
  updateHorse(id: number, updates: Partial<Horse>): Promise<Horse>;

  getTransformations(userId: string): Promise<Transformation[]>;
  createTransformation(t: InsertTransformation): Promise<Transformation>;
  updateTransformation(id: number, updates: Partial<Transformation>): Promise<Transformation>;

  getCampaignEvents(userId: string): Promise<CampaignEvent[]>;
  createCampaignEvent(event: any): Promise<CampaignEvent>;
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

  async createHorse(horse: InsertHorse): Promise<Horse> {
    const [h] = await db.insert(horses).values(horse as any).returning();
    return h;
  }

  async updateHorse(id: number, updates: Partial<Horse>): Promise<Horse> {
    const [h] = await db.update(horses).set(updates).where(eq(horses.id, id)).returning();
    return h;
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
