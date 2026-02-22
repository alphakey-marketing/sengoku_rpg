import { users, companions, equipment, type User, type UpsertUser, type InsertCompanion, type InsertEquipment, type Companion, type Equipment } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { IAuthStorage } from "./replit_integrations/auth";

export interface IStorage extends IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  getCompanions(userId: string): Promise<Companion[]>;
  createCompanion(companion: InsertCompanion): Promise<Companion>;
  updateCompanion(id: number, updates: Partial<Companion>): Promise<Companion>;
  
  getEquipment(userId: string): Promise<Equipment[]>;
  createEquipment(equip: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, updates: Partial<Equipment>): Promise<Equipment>;
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
        set: {
          ...userData,
          updatedAt: new Date(),
        },
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
}

export const storage = new DatabaseStorage();
