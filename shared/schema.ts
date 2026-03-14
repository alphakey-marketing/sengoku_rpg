import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

function serial(name: string) {
  return integer(name).generatedAlwaysAsIdentity();
}

// ── A2 / A3: Narrative flag-gate condition ──────────────────────────────────
//
// Grammar: "<flagKey><op><value>"   op ∈ { >=, >, <=, <, ==, != }
// Examples: "loyalty_hanzo>=3"  "ruthlessness<=1"  "chapter_choice_A==1"

export type CompanionUnlockCondition = string;

export function parseUnlockCondition(
  condition: string,
): { flagKey: string; op: string; threshold: number } | null {
  const match = condition.match(/^([A-Za-z0-9_]+)(>=|<=|==|!=|>|<)(-?\d+)$/);
  if (!match) return null;
  return { flagKey: match[1], op: match[2], threshold: Number(match[3]) };
}

export function evalUnlockCondition(
  condition: string,
  flagValues: Record<string, number>,
): boolean {
  const parsed = parseUnlockCondition(condition);
  if (!parsed) return true;
  const current = flagValues[parsed.flagKey] ?? 0;
  switch (parsed.op) {
    case ">=": return current >= parsed.threshold;
    case ">":  return current >  parsed.threshold;
    case "<=": return current <= parsed.threshold;
    case "<":  return current <  parsed.threshold;
    case "==": return current === parsed.threshold;
    case "!=": return current !== parsed.threshold;
    default:   return true;
  }
}

export function unlockConditionHint(
  condition: string,
  flagValues: Record<string, number>,
): string {
  const parsed = parseUnlockCondition(condition);
  if (!parsed) return "Story requirement not met";
  const current = flagValues[parsed.flagKey] ?? 0;
  const { flagKey, op, threshold } = parsed;
  const label = flagKey.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return `${label} ${op} ${threshold} (currently ${current})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core game tables
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  // ── Onboarding ────────────────────────────────────────────────────────
  currentChapter: integer("current_chapter").notNull().default(0),
  hasSeenIntro: boolean("has_seen_intro").notNull().default(false),
  titleSuffix: varchar("title_suffix", { length: 64 }),
  // ── C2: active display title ──────────────────────────────────────────
  // FK to player_titles.id — null means no title equipped
  activeTitleId: integer("active_title_id"),
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
  flagUnlockCondition: text("flag_unlock_condition"),
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
  storyFlagRequirement: text("story_flag_requirement"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true });
export type Equipment       = typeof equipment.$inferSelect;
export type InsertEquipment = typeof equipment.$inferInsert;
export type EquipmentFlagLock = { isLocked: boolean; lockReason: string | null };

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

// ── Story Engine Tables ───────────────────────────────────────────────────────
export const storyChapters = pgTable("story_chapters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  chapterOrder: integer("chapter_order").notNull().default(0),
  isLocked: boolean("is_locked").notNull().default(false),
  firstSceneId: integer("first_scene_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const storyScenes = pgTable("story_scenes", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id").notNull(),
  backgroundKey: text("background_key").notNull().default("default"),
  bgmKey: text("bgm_key").notNull().default("bgm_default"),
  sceneOrder: integer("scene_order").notNull().default(0),
  nextSceneId: integer("next_scene_id"),
  isBattleGate: boolean("is_battle_gate").notNull().default(false),
  battleEnemyKey: text("battle_enemy_key"),
  battleWinSceneId: integer("battle_win_scene_id"),
  battleLoseSceneId: integer("battle_lose_scene_id"),
  isChapterEnd: boolean("is_chapter_end").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dialogueLines = pgTable("dialogue_lines", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull(),
  speakerName: text("speaker_name").notNull().default("Narrator"),
  speakerSide: text("speaker_side").notNull().default("none"),
  portraitKey: text("portrait_key"),
  text: text("text").notNull(),
  lineOrder: integer("line_order").notNull().default(0),
});

export const storyChoices = pgTable("story_choices", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull(),
  choiceText: text("choice_text").notNull(),
  nextSceneId: integer("next_scene_id").notNull(),
  flagKey: text("flag_key"),
  flagValue: integer("flag_value"),
  flagKey2: text("flag_key2"),
  flagValue2: integer("flag_value2"),
  choiceOrder: integer("choice_order").notNull().default(0),
});

export const playerStoryProgress = pgTable("player_story_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  chapterId: integer("chapter_id").notNull(),
  currentSceneId: integer("current_scene_id"),
  isCompleted: boolean("is_completed").notNull().default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const playerFlags = pgTable("player_flags", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  flagKey: text("flag_key").notNull(),
  flagValue: integer("flag_value").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const storyEndings = pgTable("story_endings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  chapterId: integer("chapter_id").notNull(),
  endingKey: text("ending_key").notNull(),
  endingTitle: text("ending_title").notNull(),
  endingDescription: text("ending_description"),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// ── B3: Campaign Map — Held Provinces ────────────────────────────────────────
export const heldProvinces = pgTable("held_provinces", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  locationId: integer("location_id").notNull(),
  bossDefeated: boolean("boss_defeated").notNull().default(false),
  heldAt: timestamp("held_at").notNull().defaultNow(),
});

export const insertHeldProvinceSchema = createInsertSchema(heldProvinces).omit({ id: true });
export type HeldProvince       = typeof heldProvinces.$inferSelect;
export type InsertHeldProvince = typeof heldProvinces.$inferInsert;

// ── C1: Chronicle Wall ────────────────────────────────────────────────────────
//
// One row per story milestone per player.
// entryKey is a stable slug (e.g. "chapter_1_complete", "chose_mercy_owari").
// Idempotent: the server skips writes when entryKey already exists.
//
// flagSnapshot stores the full player_flags map at the moment the entry was
// written — a point-in-time record of story state for that milestone.
// Schema: { [flagKey: string]: number }

export const chronicleEntries = pgTable("chronicle_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  // Stable slug — unique per player
  entryKey: text("entry_key").notNull(),
  // Short display headline, e.g. "The Siege of Nagashino"
  headline: text("headline").notNull(),
  // Optional long-form narrative detail paragraph
  detail: text("detail"),
  // Full flag map snapshot at time of writing
  flagSnapshot: jsonb("flag_snapshot").notNull().default(sql`'{}'::jsonb`),
  // Chapter number for grouping in the UI
  chapterNumber: integer("chapter_number").notNull().default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertChronicleEntrySchema = createInsertSchema(chronicleEntries).omit({ id: true });
export type ChronicleEntry       = typeof chronicleEntries.$inferSelect;
export type InsertChronicleEntry = typeof chronicleEntries.$inferInsert;

// ── C2: Player Titles ─────────────────────────────────────────────────────────
//
// player_titles     — static catalogue (seeded, not per-user)
// player_earned_titles — join table: which titles each player has earned
// users.activeTitleId  — FK to player_titles.id
//
// Each title has an optional earnCondition using the same flag-gate grammar
// ("flagKey>=value") so the evaluateTitles() server function can auto-award
// them after every chapter completion.

export const playerTitles = pgTable("player_titles", {
  id: serial("id").primaryKey(),
  // Stable slug, e.g. "demon_king", "merciful_lord", "shadow_tactician"
  titleKey: text("title_key").notNull().unique(),
  // Display string shown in the UI, e.g. "Demon King"
  displayName: text("display_name").notNull(),
  // Flavour text shown in the title picker
  description: text("description"),
  // Optional: auto-award when this condition is met (same grammar as A2/A3)
  // Null means the title is only granted via direct grantTitle() calls.
  earnCondition: text("earn_condition"),
  // Cosmetic rarity tier: "common" | "rare" | "epic" | "legendary"
  rarity: text("rarity").notNull().default("common"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlayerTitleSchema = createInsertSchema(playerTitles).omit({ id: true });
export type PlayerTitle       = typeof playerTitles.$inferSelect;
export type InsertPlayerTitle = typeof playerTitles.$inferInsert;

export const playerEarnedTitles = pgTable("player_earned_titles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  titleId: integer("title_id").notNull(),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

export const insertPlayerEarnedTitleSchema = createInsertSchema(playerEarnedTitles).omit({ id: true });
export type PlayerEarnedTitle       = typeof playerEarnedTitles.$inferSelect;
export type InsertPlayerEarnedTitle = typeof playerEarnedTitles.$inferInsert;

// ── Drizzle relations ─────────────────────────────────────────────────────────
export const storyChaptersRelations = relations(storyChapters, ({ many }) => ({
  scenes: many(storyScenes),
}));

export const storyScenesRelations = relations(storyScenes, ({ one, many }) => ({
  chapter: one(storyChapters, {
    fields: [storyScenes.chapterId],
    references: [storyChapters.id],
  }),
  dialogueLines: many(dialogueLines),
  choices: many(storyChoices),
}));

export const dialogueLinesRelations = relations(dialogueLines, ({ one }) => ({
  scene: one(storyScenes, {
    fields: [dialogueLines.sceneId],
    references: [storyScenes.id],
  }),
}));

export const storyChoicesRelations = relations(storyChoices, ({ one }) => ({
  scene: one(storyScenes, {
    fields: [storyChoices.sceneId],
    references: [storyScenes.id],
  }),
}));

export const playerTitlesRelations = relations(playerTitles, ({ many }) => ({
  earnedBy: many(playerEarnedTitles),
}));

export const playerEarnedTitlesRelations = relations(playerEarnedTitles, ({ one }) => ({
  title: one(playerTitles, {
    fields: [playerEarnedTitles.titleId],
    references: [playerTitles.id],
  }),
}));
