import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

function serial(name: string) {
  return integer(name).generatedAlwaysAsIdentity();
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  rice: integer("rice").notNull().default(100),
  hp: integer("hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),
  attack: integer("attack").notNull().default(10),
  defense: integer("defense").notNull().default(10),
  speed: integer("speed").notNull().default(10),
  currentLocationId: integer("current_location_id").notNull().default(1),
  activeTransformId: integer("active_transform_id"),
  upgradeStones: integer("upgrade_stones").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companions = pgTable("companions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rarity: integer("rarity").notNull(),
  level: integer("level").notNull().default(1),
  hp: integer("hp").notNull().default(50),
  maxHp: integer("max_hp").notNull().default(50),
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  speed: integer("speed").notNull().default(10),
  skill: text("skill"),
  isInParty: boolean("is_in_party").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'weapon', 'armor', 'accessory', 'horse_gear'
  rarity: text("rarity").notNull(),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  expToNext: integer("exp_to_next").notNull().default(100),
  attackBonus: integer("attack_bonus").notNull().default(0),
  defenseBonus: integer("defense_bonus").notNull().default(0),
  speedBonus: integer("speed_bonus").notNull().default(0),
  isEquipped: boolean("is_equipped").notNull().default(false),
  equippedToId: integer("equipped_to_id"),
  equippedToType: text("equipped_to_type"), // 'player', 'companion'
  createdAt: timestamp("created_at").defaultNow(),
});

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rarity: integer("rarity").notNull(),
  level: integer("level").notNull().default(1),
  hp: integer("hp").notNull().default(30),
  maxHp: integer("max_hp").notNull().default(30),
  attack: integer("attack").notNull().default(5),
  defense: integer("defense").notNull().default(5),
  speed: integer("speed").notNull().default(15),
  skill: text("skill"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const horses = pgTable("horses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  rarity: integer("rarity").notNull(),
  level: integer("level").notNull().default(1),
  speedBonus: integer("speed_bonus").notNull().default(20),
  attackBonus: integer("attack_bonus").notNull().default(5),
  skill: text("skill"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transformations = pgTable("transformations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  expToNext: integer("exp_to_next").notNull().default(200),
  attackPercent: integer("attack_percent").notNull().default(30),
  defensePercent: integer("defense_percent").notNull().default(30),
  speedPercent: integer("speed_percent").notNull().default(30),
  hpPercent: integer("hp_percent").notNull().default(30),
  skill: text("skill").notNull(),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(60),
  durationSeconds: integer("duration_seconds").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  companions: many(companions),
  equipment: many(equipment),
  pets: many(pets),
  horses: many(horses),
  transformations: many(transformations),
}));

export const companionsRelations = relations(companions, ({ one }) => ({
  user: one(users, { fields: [companions.userId], references: [users.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  user: one(users, { fields: [equipment.userId], references: [users.id] }),
}));

export const petsRelations = relations(pets, ({ one }) => ({
  user: one(users, { fields: [pets.userId], references: [users.id] }),
}));

export const horsesRelations = relations(horses, ({ one }) => ({
  user: one(users, { fields: [horses.userId], references: [users.id] }),
}));

export const transformationsRelations = relations(transformations, ({ one }) => ({
  user: one(users, { fields: [transformations.userId], references: [users.id] }),
}));

// Schemas
export const insertCompanionSchema = createInsertSchema(companions).omit({ id: true, createdAt: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertPetSchema = createInsertSchema(pets).omit({ id: true, createdAt: true });
export const insertHorseSchema = createInsertSchema(horses).omit({ id: true, createdAt: true });
export const insertTransformationSchema = createInsertSchema(transformations).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Companion = typeof companions.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Pet = typeof pets.$inferSelect;
export type Horse = typeof horses.$inferSelect;
export type Transformation = typeof transformations.$inferSelect;
export type InsertCompanion = z.infer<typeof insertCompanionSchema>;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type InsertPet = z.infer<typeof insertPetSchema>;
export type InsertHorse = z.infer<typeof insertHorseSchema>;
export type InsertTransformation = z.infer<typeof insertTransformationSchema>;
