import {
  users, companions, equipment, pets, horses, transformations,
  type User, type UpsertUser, type InsertCompanion, type InsertEquipment,
  type Companion, type Equipment, type Pet, type Horse, type Transformation,
  type InsertPet, type InsertHorse, type InsertTransformation
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

  getEquipment(userId: string): Promise<Equipment[]>;
  createEquipment(equip: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment>;

  getPets(userId: string): Promise<Pet[]>;
  createPet(pet: InsertPet): Promise<Pet>;
  updatePet(id: number, updates: Partial<Pet>): Promise<Pet>;

  getHorses(userId: string): Promise<Horse[]>;
  createHorse(horse: InsertHorse): Promise<Horse>;
  updateHorse(id: number, updates: Partial<Horse>): Promise<Horse>;

  getTransformations(userId: string): Promise<Transformation[]>;
  createTransformation(t: InsertTransformation): Promise<Transformation>;
  updateTransformation(id: number, updates: Partial<Transformation>): Promise<Transformation>;
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
    const [comp] = await db.insert(companions).values(companion).returning();
    return comp;
  }

  async updateCompanion(id: number, updates: Partial<Companion>): Promise<Companion> {
    const [comp] = await db.update(companions).set(updates).where(eq(companions.id, id)).returning();
    return comp;
  }

  async getEquipment(userId: string): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.userId, userId));
  }

  async createEquipment(equip: InsertEquipment): Promise<Equipment> {
    const [eqp] = await db.insert(equipment).values(equip).returning();
    return eqp;
  }

  async updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment> {
    const [eqp] = await db.update(equipment).set(updates).where(eq(equipment.id, id)).returning();
    return eqp;
  }

  async getPets(userId: string): Promise<Pet[]> {
    return await db.select().from(pets).where(eq(pets.userId, userId));
  }

  async createPet(pet: InsertPet): Promise<Pet> {
    const [p] = await db.insert(pets).values(pet).returning();
    return p;
  }

  async updatePet(id: number, updates: Partial<Pet>): Promise<Pet> {
    const [p] = await db.update(pets).set(updates).where(eq(pets.id, id)).returning();
    return p;
  }

  async getHorses(userId: string): Promise<Horse[]> {
    return await db.select().from(horses).where(eq(horses.userId, userId));
  }

  async createHorse(horse: InsertHorse): Promise<Horse> {
    const [h] = await db.insert(horses).values(horse).returning();
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
    const [tr] = await db.insert(transformations).values(t).returning();
    return tr;
  }

  async updateTransformation(id: number, updates: Partial<Transformation>): Promise<Transformation> {
    const [tr] = await db.update(transformations).set(updates).where(eq(transformations.id, id)).returning();
    return tr;
  }
}

export const storage = new DatabaseStorage();
