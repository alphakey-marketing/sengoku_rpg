import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
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

// ── ConditionalVariant — stored in story_scenes.conditional_variants JSONB ──
//
// Each element describes one flag-gated override of the default battle routing.
// sceneId is the resolved integer DB id (not the JSON sceneRef string).
// The engine checks these before falling back to battleWinSceneId / battleLoseSceneId.

export interface ConditionalVariantCondition {
  flagKey:  string;
  operator: "gte" | "lte" | "gt" | "lt" | "eq" | "neq";
  value:    number;
}

export interface ConditionalVariant {
  outcome:   "win" | "lose";
  sceneId:   number;
  condition: ConditionalVariantCondition;
}

// ─────────────────────────────────────────────────────────────────────────────
// Story Grant System
// ─────────────────────────────────────────────────────────────────────────────
//
// A StoryGrant is a catalogue entry that describes a reward that can be issued
// to a player when specific narrative flags are satisfied at chapter completion.
//
// Flow:
//   1. Each grant record lives in `story_grants` (seeded, not per-user).
//   2. When a chapter completes, the server evaluates all grants whose
//      `chapterTrigger` matches the completed chapter.
//   3. For each qualifying grant, `evalUnlockCondition` is run against the
//      player's live flag map.
//   4. Passing grants are written to `player_story_grants` and the appropriate
//      game table row is inserted (companion / equipment / pet / horse).
//
// Grant categories map 1-to-1 onto existing game tables:
//   "companion"  → companions table
//   "equipment"  → equipment table
//   "pet"        → pets table
//   "horse"      → horses table
//
// `grantPayload` is a JSONB column whose shape is determined by `grantCategory`.
// See the StoryGrantPayload discriminated union below for exact shapes.
//
// `upgradeOf` is an optional grantKey: if set, this grant supersedes (upgrades)
// a previously issued grant with that key.  The UI should show the upgraded
// version and mark the base version as superseded.

// ── Discriminated payload shapes ────────────────────────────────────────────

export interface CompanionGrantPayload {
  category: "companion";
  name: string;
  type: string;
  rarity: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  dex: number;
  agi: number;
  /** Skill key string — resolved to human-readable description on the client */
  skill: string;
  isSpecial: boolean;
  /** If set, the companion is only added to the party when this flag condition passes */
  flagUnlockCondition: string | null;
}

export interface EquipmentGrantPayload {
  category: "equipment";
  name: string;
  type: string;
  rarity: string;
  weaponType: string | null;
  attackBonus: number;
  defenseBonus: number;
  speedBonus: number;
  hpBonus: number;
  mdefBonus: number;
  fleeBonus: number;
  matkBonus: number;
  critChance: number;
  critDamage: number;
  cardSlots: number;
  /** Human-readable description of the passive/special effect */
  passiveDescription: string | null;
  /** Flag condition that must pass for the item to appear as usable in the UI */
  storyFlagRequirement: string | null;
}

export interface PetGrantPayload {
  category: "pet";
  name: string;
  type: string;
  rarity: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  /** Skill key string */
  skill: string;
}

export interface HorseGrantPayload {
  category: "horse";
  name: string;
  rarity: string;
  speedBonus: number;
  attackBonus: number;
  defenseBonus: number;
  /** Skill key string */
  skill: string;
}

export type StoryGrantPayload =
  | CompanionGrantPayload
  | EquipmentGrantPayload
  | PetGrantPayload
  | HorseGrantPayload;

// ── story_grants: the catalogue (seeded, not per-user) ───────────────────────

export const storyGrants = pgTable("story_grants", {
  id: serial("id").primaryKey(),

  /** Stable, unique identifier referenced by seed data and grant logic */
  grantKey: text("grant_key").notNull().unique(),

  /** Human-readable label shown in the chapter-end reward screen */
  displayName: text("display_name").notNull(),

  /** Short flavour line shown beneath the item name in the reward popup */
  flavourText: text("flavour_text"),

  /** Which chapter completion triggers evaluation of this grant */
  chapterTrigger: integer("chapter_trigger").notNull(),

  /**
   * Flag condition string (parsed by evalUnlockCondition).
   * If null the grant is unconditional — awarded to every player who
   * reaches the chapter-end scene.
   *
   * Compound conditions (AND of two flags) are expressed as two separate
   * grants that both create the same game row, with the second having
   * `upgradeOf` set to the first.  This keeps the condition grammar simple
   * and the evaluation logic stateless.
   *
   * Examples:
   *   "nohime_trust>=3"
   *   "mitsuhide_loyalty>=2"
   *   "ruthlessness>=4"
   */
  flagCondition: text("flag_condition"),

  /**
   * One of: "companion" | "equipment" | "pet" | "horse"
   * Determines which game table receives the row on grant.
   */
  grantCategory: text("grant_category").notNull(),

  /**
   * JSONB payload whose shape is typed by StoryGrantPayload.
   * Validated at seed-time; treated as opaque at runtime.
   */
  grantPayload: jsonb("grant_payload").notNull().$type<StoryGrantPayload>(),

  /**
   * Optional: grantKey of the base grant this one supersedes.
   * Used to implement the Nohime / Mitsuhide "tier upgrade" pattern.
   * When this grant is awarded, the player_story_grants row for `upgradeOf`
   * is marked isSuperseded = true.
   */
  upgradeOf: text("upgrade_of"),

  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ([
  index("story_grants_chapter_trigger_idx").on(t.chapterTrigger),
  index("story_grants_grant_key_idx").on(t.grantKey),
]));

export const insertStoryGrantSchema = createInsertSchema(storyGrants).omit({ id: true });
export type StoryGrant       = typeof storyGrants.$inferSelect;
export type InsertStoryGrant = typeof storyGrants.$inferInsert;

// ── player_story_grants: per-user issued grants ──────────────────────────────

export const playerStoryGrants = pgTable("player_story_grants", {
  id: serial("id").primaryKey(),

  userId: varchar("user_id").notNull(),

  /** FK to story_grants.grant_key (not id) so it survives re-seeds */
  grantKey: text("grant_key").notNull(),

  /**
   * FK to the actual game table row that was created.
   * Null only for cosmetic-only grants that write no game row.
   */
  gameRowId: integer("game_row_id"),

  /**
   * The category of the game row ("companion" | "equipment" | "pet" | "horse").
   * Redundant with story_grants.grant_category but stored here so the client
   * can navigate to the right UI panel without a JOIN.
   */
  grantCategory: text("grant_category").notNull(),

  /**
   * True when a newer `upgradeOf` grant has been awarded that supersedes
   * this one.  The base grant row is kept so the chronicle / history UI
   * can show the progression.
   */
  isSuperseded: boolean("is_superseded").notNull().default(false),

  /** The chapter during which this grant was awarded */
  awardedAtChapter: integer("awarded_at_chapter").notNull(),

  /** Snapshot of the flag values at the moment of award (for debugging/chronicle) */
  flagSnapshot: jsonb("flag_snapshot").notNull().default(sql`'{}'::jsonb`),

  awardedAt: timestamp("awarded_at").notNull().defaultNow(),
}, (t) => ([
  index("player_story_grants_user_id_idx").on(t.userId),
  index("player_story_grants_user_grant_idx").on(t.userId, t.grantKey),
]));

export const insertPlayerStoryGrantSchema = createInsertSchema(playerStoryGrants).omit({ id: true });
export type PlayerStoryGrant       = typeof playerStoryGrants.$inferSelect;
export type InsertPlayerStoryGrant = typeof playerStoryGrants.$inferInsert;

// ── Drizzle relations for grant tables ──────────────────────────────────────

export const storyGrantsRelations = relations(storyGrants, ({ many }) => ({
  playerGrants: many(playerStoryGrants),
}));

export const playerStoryGrantsRelations = relations(playerStoryGrants, ({ one }) => ({
  grant: one(storyGrants, {
    fields: [playerStoryGrants.grantKey],
    references: [storyGrants.grantKey],
  }),
}));

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
  // FIX 1: raise starting gold so new players can buy starter gear
  gold: integer("gold").notNull().default(500),
  rice: integer("rice").notNull().default(100),
  // FIX 1: raise starting hp so a fresh player survives at least one full round
  hp: integer("hp").notNull().default(200),
  maxHp: integer("max_hp").notNull().default(200),
  // FIX 1: raise base attack/defense to be competitive with location-1 enemies
  attack: integer("attack").notNull().default(30),
  defense: integer("defense").notNull().default(20),
  speed: integer("speed").notNull().default(10),
  // FIX 1: raise all six base stats from 1 → 10 so statusATK/flee/hit
  // formulas produce meaningful values from turn 1
  str: integer("str").notNull().default(10),
  agi: integer("agi").notNull().default(10),
  vit: integer("vit").notNull().default(10),
  int: integer("int").notNull().default(10),
  dex: integer("dex").notNull().default(10),
  luk: integer("luk").notNull().default(10),
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
}, (t) => ([
  index("companions_user_id_idx").on(t.userId),
]));

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
  // ── Passive description for story-granted equipment ───────────────────
  passiveDescription: text("passive_description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ([
  index("equipment_user_id_idx").on(t.userId),
]));

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
}, (t) => ([
  index("cards_user_id_idx").on(t.userId),
  index("cards_equipment_id_idx").on(t.equipmentId),
]));

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
}, (t) => ([
  index("pets_user_id_idx").on(t.userId),
]));

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
}, (t) => ([
  index("horses_user_id_idx").on(t.userId),
]));

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
}, (t) => ([
  index("transformations_user_id_idx").on(t.userId),
]));

export const campaignEvents = pgTable("campaign_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  eventKey: text("event_key").notNull(),
  choice: text("choice"),
  isTriggered: boolean("is_triggered").notNull().default(false),
  completedAt: timestamp("completed_at"),
}, (t) => ([
  index("campaign_events_user_id_idx").on(t.userId),
]));

export const userQuests = pgTable("user_quests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  questKey: text("quest_key").notNull(),
  progress: integer("progress").notNull().default(0),
  isClaimed: boolean("is_claimed").notNull().default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (t) => ([
  index("user_quests_user_id_idx").on(t.userId),
]));

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
  // Nullable JSONB array of ConditionalVariant objects.
  // Checked by /api/story/battle-result BEFORE falling back to
  // battleWinSceneId / battleLoseSceneId.
  // Shape: { outcome: "win"|"lose", sceneId: number, condition: { flagKey, operator, value } }[]
  conditionalVariants: jsonb("conditional_variants").$type<ConditionalVariant[]>(),
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
}, (t) => ([
  index("player_story_progress_user_id_idx").on(t.userId),
]));

export const playerFlags = pgTable("player_flags", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  flagKey: text("flag_key").notNull(),
  flagValue: integer("flag_value").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ([
  index("player_flags_user_id_idx").on(t.userId),
]));

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
}, (t) => ([
  index("held_provinces_user_id_idx").on(t.userId),
]));

export const insertHeldProvinceSchema = createInsertSchema(heldProvinces).omit({ id: true });
export type HeldProvince       = typeof heldProvinces.$inferSelect;
export type InsertHeldProvince = typeof heldProvinces.$inferInsert;

// ── C1: Chronicle Wall ────────────────────────────────────────────────────────
export const chronicleEntries = pgTable("chronicle_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  entryKey: text("entry_key").notNull(),
  headline: text("headline").notNull(),
  detail: text("detail"),
  flagSnapshot: jsonb("flag_snapshot").notNull().default(sql`'{}'::jsonb`),
  chapterNumber: integer("chapter_number").notNull().default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (t) => ([
  index("chronicle_entries_user_id_idx").on(t.userId),
]));

export const insertChronicleEntrySchema = createInsertSchema(chronicleEntries).omit({ id: true });
export type ChronicleEntry       = typeof chronicleEntries.$inferSelect;
export type InsertChronicleEntry = typeof chronicleEntries.$inferInsert;

// ── C2: Player Titles ─────────────────────────────────────────────────────────
export const playerTitles = pgTable("player_titles", {
  id: serial("id").primaryKey(),
  titleKey: text("title_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  earnCondition: text("earn_condition"),
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
}, (t) => ([
  index("player_earned_titles_user_id_idx").on(t.userId),
]));

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
