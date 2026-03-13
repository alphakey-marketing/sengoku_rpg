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
  type: text("text").notNull(),
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

// campaignEvents table is retained to avoid an unplanned Drizzle migration
// against the live DB. The route, page, TS types, and Drizzle relation that
// referenced it have all been removed (Phase C1). Physical table drop is
// deferred to Phase C2 schema audit.
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
// VN STORY ENGINE — STATIC CONTENT TABLES
// =============================================================

export const storyChapters = pgTable("story_chapters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  chapterOrder: integer("chapter_order").notNull(),
  firstSceneId: integer("first_scene_id"),
  isLocked: boolean("is_locked").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const storyScenes = pgTable("story_scenes", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id").notNull(),
  backgroundKey: text("background_key").notNull().default("default"),
  bgmKey: text("bgm_key").notNull().default("default"),
  sceneOrder: integer("scene_order").notNull(),
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
  speakerName: text("speaker_name").notNull(),
  speakerSide: text("speaker_side").notNull().default("none"),
  text: text("text").notNull(),
  portraitKey: text("portrait_key"),
  lineOrder: integer("line_order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================================
// VN STORY ENGINE — PLAYER STATE TABLES
// =============================================================

export const playerFlags = pgTable("player_flags", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  flagKey: text("flag_key").notNull(),
  flagValue: integer("flag_value").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const playerProgress = pgTable("player_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  chapterId: integer("chapter_id").notNull(),
  currentSceneId: integer("current_scene_id"),
  isCompleted: boolean("is_completed").notNull().default(false),
  seenSceneIds: jsonb("seen_scene_ids").notNull().default(sql`'[]'::jsonb`),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const unlockedEndings = pgTable("unlocked_endings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  endingKey: text("ending_key").notNull(),
  endingTitle: text("ending_title").notNull(),
  endingDescription: text("ending_description").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// =============================================================
// RELATIONS
// =============================================================

export const usersRelations = relations(users, ({ many }) => ({
  companions: many(companions),
  equipment: many(equipment),
  pets: many(pets),
  horses: many(horses),
  transformations: many(transformations),
  quests: many(userQuests),
  playerFlags: many(playerFlags),
  playerProgress: many(playerProgress),
  unlockedEndings: many(unlockedEndings),
}));

export const userQuestsRelations = relations(userQuests, ({ one }) => ({
  user: one(users, { fields: [userQuests.userId], references: [users.id] }),
}));

export const companionsRelations = relations(companions, ({ one }) => ({
  user: one(users, { fields: [companions.userId], references: [users.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  user: one(users, { fields: [equipment.userId], references: [users.id] }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  user: one(users, { fields: [cards.userId], references: [users.id] }),
  equipment: one(equipment, { fields: [cards.equipmentId], references: [equipment.id] }),
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

// =============================================================
// RELATIONS — VN STORY ENGINE
// =============================================================

export const storyChaptersRelations = relations(storyChapters, ({ many }) => ({
  scenes: many(storyScenes),
  playerProgress: many(playerProgress),
}));

export const storyScenesRelations = relations(storyScenes, ({ one, many }) => ({
  chapter: one(storyChapters, { fields: [storyScenes.chapterId], references: [storyChapters.id] }),
  dialogueLines: many(dialogueLines),
  choices: many(storyChoices),
}));

export const dialogueLinesRelations = relations(dialogueLines, ({ one }) => ({
  scene: one(storyScenes, { fields: [dialogueLines.sceneId], references: [storyScenes.id] }),
}));

export const storyChoicesRelations = relations(storyChoices, ({ one }) => ({
  scene: one(storyScenes, { fields: [storyChoices.sceneId], references: [storyScenes.id] }),
}));

export const playerFlagsRelations = relations(playerFlags, ({ one }) => ({
  user: one(users, { fields: [playerFlags.userId], references: [users.id] }),
}));

export const playerProgressRelations = relations(playerProgress, ({ one }) => ({
  user: one(users, { fields: [playerProgress.userId], references: [users.id] }),
  chapter: one(storyChapters, { fields: [playerProgress.chapterId], references: [storyChapters.id] }),
}));

export const unlockedEndingsRelations = relations(unlockedEndings, ({ one }) => ({
  user: one(users, { fields: [unlockedEndings.userId], references: [users.id] }),
}));

// =============================================================
// INSERT SCHEMAS & TYPES
// =============================================================

export const insertCardSchema = createInsertSchema(cards).omit({ id: true, createdAt: true });
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;

export const insertCompanionSchema = createInsertSchema(companions, {
  isInParty: z.boolean(),
  isSpecial: z.boolean(),
}).omit({ id: true, createdAt: true });
export const insertEquipmentSchema = createInsertSchema(equipment, {
  isEquipped: z.boolean(),
}).omit({ id: true, createdAt: true });
export const insertPetSchema = createInsertSchema(pets, {
  isActive: z.boolean(),
}).omit({ id: true, createdAt: true });
export const insertHorseSchema = createInsertSchema(horses, {
  isActive: z.boolean(),
}).omit({ id: true, createdAt: true });
export const insertTransformationSchema = createInsertSchema(transformations).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
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

// =============================================================
// INSERT SCHEMAS & TYPES — VN STORY ENGINE
// =============================================================

export const insertStoryChapterSchema = createInsertSchema(storyChapters, {
  isLocked: z.boolean(),
}).omit({ id: true, createdAt: true });

export const insertStorySceneSchema = createInsertSchema(storyScenes, {
  isBattleGate: z.boolean(),
  isChapterEnd: z.boolean(),
}).omit({ id: true, createdAt: true });

export const insertDialogueLineSchema = createInsertSchema(dialogueLines).omit({ id: true, createdAt: true });

export const insertStoryChoiceSchema = createInsertSchema(storyChoices).omit({ id: true, createdAt: true });

export const insertPlayerFlagSchema = createInsertSchema(playerFlags).omit({ id: true, updatedAt: true });

export const insertPlayerProgressSchema = createInsertSchema(playerProgress, {
  isCompleted: z.boolean(),
}).omit({ id: true, startedAt: true, completedAt: true });

export const insertUnlockedEndingSchema = createInsertSchema(unlockedEndings).omit({ id: true, unlockedAt: true });

export type StoryChapter = typeof storyChapters.$inferSelect;
export type StoryScene = typeof storyScenes.$inferSelect;
export type DialogueLine = typeof dialogueLines.$inferSelect;
export type StoryChoice = typeof storyChoices.$inferSelect;
export type PlayerFlag = typeof playerFlags.$inferSelect;
export type PlayerProgress = typeof playerProgress.$inferSelect;
export type UnlockedEnding = typeof unlockedEndings.$inferSelect;
export type InsertStoryChapter = z.infer<typeof insertStoryChapterSchema>;
export type InsertStoryScene = z.infer<typeof insertStorySceneSchema>;
export type InsertDialogueLine = z.infer<typeof insertDialogueLineSchema>;
export type InsertStoryChoice = z.infer<typeof insertStoryChoiceSchema>;
export type InsertPlayerFlag = z.infer<typeof insertPlayerFlagSchema>;
export type InsertPlayerProgress = z.infer<typeof insertPlayerProgressSchema>;
export type InsertUnlockedEnding = z.infer<typeof insertUnlockedEndingSchema>;
