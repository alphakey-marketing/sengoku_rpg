import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

function serial(name: string) {
  return integer(name).generatedAlwaysAsIdentity();
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Phase 3: Supabase auth UUID — populated on first Supabase sign-in.
  // Null while AUTH_PROVIDER=replit; used as the lookup key for Supabase path.
  authUserId: varchar("auth_user_id").unique(),
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
  str: integer("str").notNull().default(1),
  agi: integer("agi").notNull().default(1),
  vit: integer("vit").notNull().default(1),
  int: integer("int").notNull().default(1),
  dex: integer("dex").notNull().default(1),
  luk: integer("luk").notNull().default(1),
  stamina: integer("stamina").notNull().default(100),
  maxStamina: integer("max_stamina").notNull().default(100),
  currentLocationId: integer("current_location_id").notNull().default(1),
  activeTransformId: integer("active_transform_id"),
  transformActiveUntil: timestamp("transform_active_until"),
  transformationStones: integer("transformation_stones").notNull().default(0),
  upgradeStones: integer("upgrade_stones").notNull().default(0),
  endowmentStones: integer("endowment_stones").notNull().default(0),
  fireGodTalisman: integer("fire_god_talisman").notNull().default(0),
  flameEmperorTalisman: integer("flame_emperor_talisman").notNull().default(0),
  petEssence: integer("pet_essence").notNull().default(0),
  warriorSouls: integer("warrior_soul").notNull().default(0),
  seppukuCount: integer("seppuku_count").notNull().default(0),
  statPoints: integer("stat_points").notNull().default(48),
  permAttackBonus: integer("perm_attack_bonus").notNull().default(0),
  permDefenseBonus: integer("perm_defense_bonus").notNull().default(0),
  permSpeedBonus: integer("perm_speed_bonus").notNull().default(0),
  permHpBonus: integer("perm_hp_bonus").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companions = pgTable("companions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rarity: text("rarity").notNull(),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  expToNext: integer("exp_to_next").notNull().default(100),
  hp: integer("hp").notNull().default(50),
  maxHp: integer("max_hp").notNull().default(50),
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  speed: integer("speed").notNull().default(10),
  dex: integer("dex").notNull().default(10),
  agi: integer("agi").notNull().default(10),
  skill: text("skill"),
  isInParty: boolean("is_in_party").notNull().default(false),
  isSpecial: boolean("is_special").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rarity: text("rarity").notNull().default("white"),
  weaponType: text("weapon_type"),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  expToNext: integer("exp_to_next").notNull().default(100),
  attackBonus: integer("attack_bonus").notNull().default(0),
  defenseBonus: integer("defense_bonus").notNull().default(0),
  speedBonus: integer("speed_bonus").notNull().default(0),
  hpBonus: integer("hp_bonus").notNull().default(0),
  mdefBonus: integer("mdef_bonus").notNull().default(0),
  fleeBonus: integer("flee_bonus").notNull().default(0),
  matkBonus: integer("matk_bonus").notNull().default(0),
  critChance: integer("crit_chance").notNull().default(0),
  critDamage: integer("crit_damage").notNull().default(0),
  endowmentPoints: integer("endowment_points").notNull().default(0),
  isEquipped: boolean("is_equipped").notNull().default(false),
  equippedToId: integer("equipped_to_id"),
  equippedToType: text("equipped_to_type"),
  cardSlots: integer("card_slots").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  effectDescription: text("effect_description").notNull(),
  stats: text("stats"),
  rarity: text("rarity").notNull(),
  equipmentId: integer("equipment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rarity: text("rarity").notNull(),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  expToNext: integer("exp_to_next").notNull().default(100),
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
  rarity: text("rarity").notNull(),
  level: integer("level").notNull().default(1),
  speedBonus: integer("speed_bonus").notNull().default(10),
  attackBonus: integer("attack_bonus").notNull().default(0),
  defenseBonus: integer("defense_bonus").notNull().default(0),
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

export const campaignEvents = pgTable("campaign_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  eventKey: text("event_key").notNull(),
  choice: text("choice"),
  isTriggered: boolean("is_triggered").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

export const userQuests = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  questKey: text("quest_key").notNull(),
  progress: integer("progress").notNull().default(0),
  isClaimed: boolean("is_claimed").notNull().default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// =============================================================
// V