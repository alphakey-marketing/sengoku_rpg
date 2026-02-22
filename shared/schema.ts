import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Required by Replit Auth
export * from "./models/auth";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Game progression
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  rice: integer("rice").notNull().default(100), // Used for gacha
  
  // Stats
  attack: integer("attack").notNull().default(10),
  defense: integer("defense").notNull().default(10),
  
  // Current location
  currentLocationId: integer("current_location_id").notNull().default(1),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companions = pgTable("companions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'historical' or 'original'
  rarity: integer("rarity").notNull(), // 1 to 5 stars
  level: integer("level").notNull().default(1),
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  skill: text("skill"),
  isInParty: boolean("is_in_party").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'weapon', 'armor', 'accessory'
  rarity: text("rarity").notNull(), // 'white', 'green', 'blue', 'purple', 'gold'
  level: integer("level").notNull().default(1),
  attackBonus: integer("attack_bonus").notNull().default(0),
  defenseBonus: integer("defense_bonus").notNull().default(0),
  isEquipped: boolean("is_equipped").notNull().default(false),
  equippedToId: integer("equipped_to_id"), // null if equipped to main char, companion ID if equipped to companion
  createdAt: timestamp("created_at").defaultNow(),
});

// Use serial for IDs in normal tables since we aren't using UUIDs for them
function serial(name: string) {
  return integer(name).generatedAlwaysAsIdentity();
}

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  companions: many(companions),
  equipment: many(equipment),
}));

export const companionsRelations = relations(companions, ({ one }) => ({
  user: one(users, {
    fields: [companions.userId],
    references: [users.id],
  }),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  user: one(users, {
    fields: [equipment.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertCompanionSchema = createInsertSchema(companions).omit({ id: true, createdAt: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Companion = typeof companions.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
