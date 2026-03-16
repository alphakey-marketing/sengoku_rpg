import { db } from "./db";
import { playerFlags, playerStoryGrants, horses } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { EnemyStats, TeamStats } from "../client/src/hooks/use-game";
import { getSkillDescription } from "@shared/skill-descriptions";

// ── Types ───────────────────────────────────────────────────────────────────────────

export type WeaponType =
  | "dagger"
  | "sword"
  | "twoHandSword"
  | "axe"
  | "mace"
  | "spear"
  | "knuckle"
  | "katar"
  | "book"
  | "staff"
  | "bow"
  | "gun"
  | "instrument"
  | "whip"
  | "none";

export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  aspd?: number;
  weaponType?: WeaponType;

  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  dex?: number;
  luk?: number;

  hardDEF?: number;
  softDEF?: number;

  weaponATK?: number;
  weaponLevel?: number;
  refinementBonus?: number;
  bonusATK?: number;

  hit?: number;
  flee?: number;
  critChance: number;
  critDamage: number;
  isPlayer: boolean;
  // M10 NOTE: stamina / maxStamina kept in the interface for future skill-cost
  // mechanics but are no longer hardcoded to 100; they read from the team
  // stats object (sp / maxSp) which is INT-scaled by player-stats.ts.
  stamina?: number;
  maxStamina?: number;
  statusEffects: { type: string; duration: number; value?: number }[];
  isGuarding: boolean;
  // M10 NOTE: endowmentPoints retained in the interface for future use;
  // the damage formula no longer reads it (it was always 0 and silently
  // swallowed future endowment mechanics).
  endowmentPoints?: number;
  /** Story-grant skill key attached to this unit, if any (Part 8/10) */
  grantSkillKey?: string;
}

// ── Weapon helpers ────────────────────────────────────────────────────────────────────

export function isMeleeWeapon(type: WeaponType | undefined): boolean {
  if (!type) return true;
  return ["dagger","sword","twoHandSword","axe","mace","spear","knuckle","katar","book","staff","none"].includes(type);
}

export function isRangedWeapon(type: WeaponType | undefined): boolean {
  if (!type) return false;
  return ["bow","gun","instrument","whip"].includes(type);
}

// ── Hit / damage formulas ──────────────────────────────────────────────────────────────

export function calculateHitChance(attacker: CombatUnit, defender: CombatUnit): number {
  const hit   = attacker.hit  ?? 0;
  const flee  = defender.flee ?? 0;
  return Math.min(95, Math.max(5, hit - flee));
}

function getStatusATK(attacker: CombatUnit): number {
  const lv  = (attacker as any).level ?? 1;
  const STR = attacker.str ?? 1;
  const DEX = attacker.dex ?? 1;
  const LUK = attacker.luk ?? 1;
  if (isRangedWeapon(attacker.weaponType)) {
    return Math.floor(lv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3);
  }
  return Math.floor(lv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
}

function getWeaponATKWithStatBonus(unit: CombatUnit): number {
  const base = unit.weaponATK ?? unit.attack ?? 0;
  const bonus = isRangedWeapon(unit.weaponType)
    ? 0.005 * (unit.dex ?? 1)
    : 0.005 * (unit.str ?? 1);
  return Math.floor(base * (1 + bonus));
}

function getWeaponRoll(attacker: CombatUnit): number {
  const weaponATK     = getWeaponATKWithStatBonus(attacker);
  const weaponLevel   = attacker.weaponLevel  ?? 1;
  const varianceRange = 0.05 * weaponLevel * weaponATK;
  const variance      = (Math.random() * 2 * varianceRange) - varianceRange;
  return Math.floor(weaponATK + variance + (attacker.refinementBonus ?? 0) + (attacker.bonusATK ?? 0));
}

function getTotalATK(attacker: CombatUnit): number {
  return getStatusATK(attacker) + getWeaponRoll(attacker);
}

export function calculateDamage(attacker: CombatUnit, defender: CombatUnit, isCritical = false): number {
  let damage = getTotalATK(attacker);

  // Apply spirit_debuff: each stack reduces hardDEF by 10%
  const spiritDebuffs = defender.statusEffects.filter(s => s.type === "spirit_debuff").length;
  const hardDEF = Math.max(0, (defender.hardDEF ?? defender.defense ?? 0) * Math.pow(0.9, spiritDebuffs));
  damage = Math.floor(damage * (100 / (100 + hardDEF)));

  const softDEF = Math.floor((defender.vit ?? 1) / 2) + Math.floor((defender.agi ?? 1) / 5) + (defender.softDEF ?? 0);
  damage = Math.max(1, damage - softDEF);

  if (isCritical) {
    damage = Math.floor(damage * (1.5 + (attacker.critDamage ?? 0) / 100));
  }

  // M10 FIX: endowmentPoints block removed — it was always 0 (field never
  // populated from teamStats) and silently masked future endowment mechanics.
  // When endowment damage reduction is implemented it should be re-added here
  // with a proper source value.

  if (defender.isGuarding) damage = Math.floor(damage * 0.7);

  return Math.max(1, damage);
}

// ──────────────────────────────────────────────────────────────────────────────────
// Story-grant skill stat reader  (Part 8/10)
// ──────────────────────────────────────────────────────────────────────────────────
//
// resolveGrantSkills() is called once per combat by the caller (routes.ts)
// BEFORE runTurnBasedCombat().  It performs two DB reads and returns a
// GrantSkillContext that is passed through to the turn loop.
//
// Why two separate reads instead of one JOIN?
// ─────────────────────────────────────────────────
//  • Horse speed: player_story_grants WHERE grant_category = 'horse' is a
//    single-row read (each player has at most one active horse at a time).
//    We then look up the horse row to get its speed stat directly — clean
//    and avoids a three-table join.
//
//  • Companion skills: player_story_grants WHERE grant_category = 'companion'
//    returns at most 2 rows (the max party size for the Ch3–8 arc) and the
//    skill key is stored in grantKey which maps directly to skill-descriptions.ts.
//
// The horse speed bonus is baked into the player unit’s aspd before the turn
// order sort; all other skills are applied as on_enter / counter effects
// during the turn loop.

export interface GrantSkillContext {
  /** Additional aspd to add to the player unit (from horse speed stat) */
  horseAspdBonus: number;
  /** Set of active skill keys from non-superseded companion grants */
  companionSkillKeys: Set<string>;
  /** Set of active skill keys from non-superseded pet grants */
  petSkillKeys: Set<string>;
  /** Log lines generated during skill resolution (shown in pre-combat narration) */
  preLog: string[];
}

/**
 * Reads story-grant skill context from the DB for a given user.
 *
 * Designed to be called once per combat session, not per-turn, so the cost
 * is two indexed reads (not in the hot path).
 *
 * Returns sensible zero-value defaults if the player has no active grants,
 * so callers never need to null-check.
 */
export async function resolveGrantSkills(userId: string): Promise<GrantSkillContext> {
  const ctx: GrantSkillContext = {
    horseAspdBonus:    0,
    companionSkillKeys: new Set(),
    petSkillKeys:       new Set(),
    preLog:             [],
  };

  // Read all non-superseded grants for this player in one pass.
  const grants = await db
    .select({
      grantKey:      playerStoryGrants.grantKey,
      grantCategory: playerStoryGrants.grantCategory,
      gameRowId:     playerStoryGrants.gameRowId,
      isSuperseded:  playerStoryGrants.isSuperseded,
    })
    .from(playerStoryGrants)
    .where(
      and(
        eq(playerStoryGrants.userId, userId),
        eq(playerStoryGrants.isSuperseded, false),
      ),
    );

  if (grants.length === 0) return ctx;

  // ─ Horse: read speed stat and convert to aspd bonus ───────────────────────────
  // aspd bonus = floor(horseSpeed / 2)  — a horse with speed 40 contributes
  // +20 aspd, giving the player a meaningful but not game-breaking initiative edge.
  const horseGrant = grants.find((g) => g.grantCategory === "horse" && g.gameRowId != null);
  if (horseGrant?.gameRowId) {
    const [horseRow] = await db
      .select({ speed: horses.speed })
      .from(horses)
      .where(eq(horses.id, horseGrant.gameRowId))
      .limit(1);
    if (horseRow?.speed) {
      ctx.horseAspdBonus = Math.floor(horseRow.speed / 2);
      const skillDesc = getSkillDescription(horseGrant.grantKey);
      if (ctx.horseAspdBonus > 0) {
        ctx.preLog.push(
          `[${skillDesc?.name ?? horseGrant.grantKey}] Your mount's speed adds +${ctx.horseAspdBonus} initiative.`,
        );
      }
    }
  }

  // ─ Companion skills ──────────────────────────────────────────────────────────────
  for (const g of grants.filter((g) => g.grantCategory === "companion")) {
    const skillDesc = getSkillDescription(g.grantKey);
    if (!skillDesc) continue; // key not yet registered — skip silently
    ctx.companionSkillKeys.add(g.grantKey);
    ctx.preLog.push(`[${skillDesc.name}] ${skillDesc.description}`);
  }

  // ─ Pet skills ──────────────────────────────────────────────────────────────────────
  for (const g of grants.filter((g) => g.grantCategory === "pet")) {
    const skillDesc = getSkillDescription(g.grantKey);
    if (!skillDesc) continue;
    ctx.petSkillKeys.add(g.grantKey);
    ctx.preLog.push(`[${skillDesc.name}] ${skillDesc.description}`);
  }

  return ctx;
}

// ── A1: Flag-modified battle stats (continuous, story-driven) ────────────────────
//
// Each story flag applies a soft, incremental bonus that scales directly with
// the raw flag value earned through Chapter choices — no hard thresholds.
//
//  ruthlessness          → +5% ATK per point (cap +50%) for every player unit
//  supernatural_affinity → +4% HP per point (cap +40%); at ≥1 all enemies
//                          gain a spirit_debuff (−10% effective hardDEF)
//  political_power       → enemy count trimmed by 1 per 3 points (min 1 enemy)
//  mitsuhide_loyalty     → amplifies all three above bonuses by +2% per point
//                          (cap +20% amplification)
//
// NOTE: ATK and HP bonuses are already baked into the team stats by
// player-stats.ts before combat runs. applyFlagModifiers here only handles
// effects that must be applied TO THE ENEMY ARRAY (spirit_debuff, enemy trim)
// and appends narrative log lines so the player can see the effect.

export async function applyFlagModifiers(
  userId: string,
  team: TeamStats,
  enemies: EnemyStats[],
): Promise<string[]> {
  const modifierLog: string[] = [];

  const rows = await db.select().from(playerFlags).where(eq(playerFlags.userId, userId));
  const flags: Record<string, number> = {};
  for (const r of rows) flags[r.flagKey] = r.flagValue;

  const ruthlessness   = flags.ruthlessness          ?? 0;
  const supernatural   = flags.supernatural_affinity ?? 0;
  const political      = flags.political_power       ?? 0;
  const loyalty        = flags.mitsuhide_loyalty     ?? 0;
  const loyaltyAmp     = 1 + Math.min(0.20, loyalty * 0.02);

  if (ruthlessness > 0) {
    const pct = Math.round(Math.min(50, ruthlessness * 5) * loyaltyAmp);
    modifierLog.push(`[Force +${pct}%] The blood of your past choices fuels your blade.`);
  }

  if (supernatural >= 1) {
    for (const e of enemies) {
      if (!(e as any).statusEffects) (e as any).statusEffects = [];
      (e as any).statusEffects.push({ type: "spirit_debuff", duration: 99, value: 0.1 });
    }
    const pct = Math.round(Math.min(40, supernatural * 4) * loyaltyAmp);
    modifierLog.push(`[Spirit +${pct}% HP] Unseen forces unnerve the enemy — their armour falters.`);
  }

  const trim = Math.min(enemies.length - 1, Math.floor(political / 3));
  if (trim > 0) {
    enemies.splice(enemies.length - trim, trim);
    modifierLog.push(`[Influence] Your name alone disbands ${trim} enemy unit${trim > 1 ? "s" : ""}.`);
  }

  if (loyalty > 0) {
    modifierLog.push(`[Mitsuhide] His unwavering loyalty amplifies your every advantage.`);
  }

  return modifierLog;
}

// ──────────────────────────────────────────────────────────────────────────────────
// Story-grant skill effects  (Part 8/10)
// ──────────────────────────────────────────────────────────────────────────────────
//
// applyGrantSkillsOnEnter  — called once at the top of combat before Turn 1
// applyGrantSkillsOnHit    — called after every successful hit by a player unit
// applyGrantSkillsOnLowHp  — called after any hit that drops the player below 30%
// applyGrantSkillsCounter  — called after any hit received by the player
// applyGrantDebuffAuras    — called once at the top of combat (same timing as on_enter)
//
// Each function is pure: it mutates the passed units/enemies in place and
// returns an array of log lines.  No DB I/O inside these functions — all
// data was loaded once by resolveGrantSkills() before combat started.

/** on_enter: fired once at the start of combat before the first turn. */
export function applyGrantSkillsOnEnter(
  units:   CombatUnit[],
  enemies: CombatUnit[],
  ctx:     GrantSkillContext,
  logs:    string[],
): void {
  const player = units.find((u) => u.isPlayer && u.id === "player");
  if (!player) return;

  // veteran_charge — player acts first regardless of aspd comparison
  // Implemented by forcing a massive one-turn aspd boost that is zeroed
  // after the opening sort.  We tag the unit so the turn loop knows to
  // clear it after sort.
  if (ctx.companionSkillKeys.has("veteran_charge")) {
    (player as any)._veteranChargeActive = true;
    player.aspd = (player.aspd ?? 0) + 9999;
    logs.push(`[Veteran Charge] Your warhorse surges forward — you seize the initiative.`);
  }

  // the_work_continues — restore 5% max HP at combat start
  if (ctx.companionSkillKeys.has("the_work_continues") || ctx.petSkillKeys.has("the_work_continues")) {
    const heal = Math.floor(player.maxHp * 0.05);
    player.hp  = Math.min(player.maxHp, player.hp + heal);
    logs.push(`[The Work Continues] Dawn light steadies your resolve. Restored ${heal} HP.`);
  }

  // false_position (Nohime Intelligence) — taunt: redirect one incoming hit
  // Implemented as a one-shot status effect on the companion unit.
  if (ctx.companionSkillKeys.has("false_position")) {
    const nohime = units.find((u) => u.grantSkillKey === "false_position");
    if (nohime) {
      nohime.statusEffects.push({ type: "taunt_one_hit", duration: 1 });
      logs.push(`[False Position] Nohime steps forward to draw the enemy's eye.`);
    }
  }

  // omen_sense — 20% chance to negate enemy first-strike
  if (ctx.petSkillKeys.has("omen_sense") && Math.random() < 0.20) {
    // Give all enemies a "stunned" status for the first attack only.
    for (const e of enemies) {
      e.statusEffects.push({ type: "Stun", duration: 1 });
    }
    logs.push(`[Omen Sense] Your fox spirit cries out — the ambush is foiled.`);
  }
}

/** debuff_aura: applied once at combat start to enemy units. */
export function applyGrantDebuffAuras(
  enemies: CombatUnit[],
  ctx:     GrantSkillContext,
  logs:    string[],
): void {
  // court_presence — −6% enemy attack for 3 turns
  // Implemented as a status effect the turn loop checks before attack calc.
  if (ctx.petSkillKeys.has("court_presence")) {
    for (const e of enemies) {
      e.statusEffects.push({ type: "morale_break", duration: 3, value: 0.06 });
    }
    logs.push(`[Court Presence] The diplomatic crane unsettles enemy ranks — their attack falters.`);
  }
}

/**
 * on_hit: called after every successful hit landed by a player-side unit.
 *
 * @param attacker   The unit that just landed a hit
 * @param target     The unit that was hit
 * @param baseDamage The damage already applied
 * @param prevMissed Whether the previous action by this unit was a miss
 */
export function applyGrantSkillsOnHit(
  attacker:    CombatUnit,
  target:      CombatUnit,
  baseDamage:  number,
  prevMissed:  boolean,
  ctx:         GrantSkillContext,
  logs:        string[],
): number {
  let extraDamage = 0;

  // measured_strike (Mitsuhide) — +12% damage on the turn after a miss
  if (
    attacker.isPlayer &&
    prevMissed &&
    ctx.companionSkillKeys.has("measured_strike")
  ) {
    extraDamage = Math.floor(baseDamage * 0.12);
    target.hp  -= extraDamage;
    logs.push(`[Measured Strike] Mitsuhide finds the gap — +${extraDamage} bonus damage.`);
  }

  return extraDamage;
}

/**
 * on_low_hp: called after any hit that leaves the player below 30% max HP.
 *
 * @param player     The player CombatUnit
 * @param incomingDmg The damage that just triggered the low-HP state
 */
export function applyGrantSkillsOnLowHp(
  player:      CombatUnit,
  incomingDmg: number,
  ctx:         GrantSkillContext,
  logs:        string[],
): void {
  // last_counsel (Mitsuhide Resolved) — intercept next hit, absorb up to 40 dmg
  // Implemented as a one-shot absorb status on the player.
  if (
    ctx.companionSkillKeys.has("last_counsel") &&
    !(player as any)._lastCounselUsed
  ) {
    const absorb = Math.min(40, incomingDmg);
    player.hp   += absorb;   // undo part of the damage already applied
    (player as any)._lastCounselUsed = true;
    logs.push(`[Last Counsel] Mitsuhide steps in front — absorbs ${absorb} damage.`);
  }
}

/**
 * counter: called after the player receives any hit.
 *
 * @param attacker  The enemy unit that just hit the player
 * @param player    The player CombatUnit
 * @param damage    The damage already applied to the player
 */
export function applyGrantSkillsCounter(
  attacker: CombatUnit,
  player:   CombatUnit,
  damage:   number,
  ctx:      GrantSkillContext,
  logs:     string[],
): number {
  let mitigation = 0;

  // counter_read (Nohime) — 8% incoming damage reduction while she is in party
  if (ctx.companionSkillKeys.has("counter_read")) {
    mitigation = Math.floor(damage * 0.08);
    player.hp += mitigation;   // partial refund of already-applied damage
    logs.push(`[Counter Read] Nohime reads the strike — mitigates ${mitigation} damage.`);
  }

  return mitigation;
}

/**
 * passive_aura helper: returns the EXP multiplier from pet skills.
 * Called after combat resolution to scale the XP reward.
 *
 * Returns 1.0 if no relevant pets are active (no bonus).
 */
export function getGrantExpMultiplier(ctx: GrantSkillContext): number {
  let mult = 1.0;
  // survivors_weight — +8% EXP from all combats
  if (ctx.petSkillKeys.has("survivors_weight")) mult += 0.08;
  return mult;
}

/**
 * passive_stat helper: returns the additional dodge chance from pet skills.
 * Called inside calculateHitChance() by the turn loop when the defender
 * is the player.
 *
 * Returns 0.0 if no relevant pets are active.
 */
export function getGrantDodgeBonus(
  unit: CombatUnit,
  ctx:  GrantSkillContext,
): number {
  if (!unit.isPlayer) return 0;
  let bonus = 0;
  // nohimes_eye — +5% dex-derived dodge chance
  if (ctx.petSkillKeys.has("nohimes_eye")) {
    bonus += Math.floor((unit.dex ?? 1) * 0.05);
  }
  return bonus;
}

// ── Turn-based combat resolver ──────────────────────────────────────────────────────────
//
// CHANGES from original (Part 8/10):
//
//  1. Accepts optional GrantSkillContext (defaults to zero-value context if
//     not supplied, so all existing callers continue to work without changes).
//
//  2. Horse aspd bonus baked into player unit during build step.
//
//  3. veteran_charge aspd inflation cleared after the opening turn sort.
//
//  4. applyGrantSkillsOnEnter + applyGrantDebuffAuras called before Turn 1.
//
//  5. morale_break status applied to enemy attack before each hit calculation.
//
//  6. nohimes_eye dodge bonus applied to enemy hit-chance check.
//
//  7. applyGrantSkillsOnHit called after each successful player hit.
//
//  8. applyGrantSkillsCounter called after each hit received by the player.
//
//  9. applyGrantSkillsOnLowHp called when player HP < 30% after a hit.
//
// 10. getGrantExpMultiplier applied to a "expMultiplier" field on the return
//     value so the calling route can scale XP rewards.
//
// All original formulas, the flag-modifier system, and the existing
// return shape are preserved verbatim.

export function runTurnBasedCombat(
  playerTeam: TeamStats,
  enemies: EnemyStats[],
  grantCtx?: GrantSkillContext,
) {
  // Fall back to a zero-value context if caller didn’t supply one — this
  // keeps every existing call-site working with no code changes.
  const ctx: GrantSkillContext = grantCtx ?? {
    horseAspdBonus:    0,
    companionSkillKeys: new Set(),
    petSkillKeys:       new Set(),
    preLog:             [],
  };

  const logs: string[] = [];
  const units: CombatUnit[] = [];

  // ── Build player unit ────────────────────────────────────────────────────────────────────────
  const p     = playerTeam.player;
  const pAGI  = Number((p as any).agi  || 1);
  const pDEX  = Number((p as any).dex  || 1);
  const pLUK  = Number((p as any).luk  || 1);
  const pLv   = Number((p as any).level || 1);

  units.push({
    id: "player",
    name:    p.name,
    hp:      Number(p.hp)     || 0,
    maxHp:   Number(p.maxHp)  || 0,
    attack:  Number(p.attack) || 0,
    defense: Number(p.defense) || 0,
    // Part 8: horse aspd bonus added here
    aspd:    100 + pAGI + Math.floor(pDEX / 4) + ctx.horseAspdBonus,
    str:     Number((p as any).str  || 1),
    agi:     pAGI,
    vit:     Number((p as any).vit  || 1),
    int:     Number((p as any).int  || 1),
    dex:     pDEX,
    luk:     pLUK,
    hardDEF: Number(p.defense) || 0,
    softDEF: Number((p as any).softDEF) || 0,
    weaponATK:      Number((p as any).weaponATK  || p.attack) || 0,
    weaponLevel:    Number((p as any).weaponLevel || 1),
    weaponType:     (p as any).weaponType,
    refinementBonus: 0,
    bonusATK:       Number((p as any).bonusATK || 0),
    hit:  175 + pLv + pDEX + Math.floor(pLUK / 3),
    flee: 100 + pLv + pAGI + Math.floor(pLUK / 5) + Math.floor(pLUK / 10),
    critChance: Number((p as any).critChance) || 0,
    critDamage: Number((p as any).critDamage) || 0,
    isPlayer: true,
    stamina:    Number((p as any).sp    || (p as any).stamina    || 100),
    maxStamina: Number((p as any).maxSp || (p as any).maxStamina || 100),
    statusEffects: [],
    isGuarding: false,
    level: pLv,
  } as any);

  // ── Build companion units ────────────────────────────────────────────────────────────────
  for (let i = 0; i < playerTeam.companions.length; i++) {
    const c    = playerTeam.companions[i];
    const cLv  = Number(c.level)  || 1;
    const cAGI = Number((c as any).agi || 10);
    const cDEX = Number((c as any).dex || 10);
    const cLUK = Number((c as any).luk || 1);
    units.push({
      id: `comp-${i}`,
      name:    c.name,
      hp:      Number(c.hp)     || 0,
      maxHp:   Number(c.maxHp)  || 0,
      attack:  Number(c.attack) || 0,
      defense: Number(c.defense) || 0,
      aspd:    100 + cAGI + Math.floor(cDEX / 4),
      weaponType: (c as any).weaponType,
      str: Number((c as any).str || 10),
      agi: cAGI,
      vit: Number((c as any).vit || 10),
      int: Number((c as any).int || 10),
      dex: cDEX,
      luk: cLUK,
      hardDEF:       Number(c.defense) || 0,
      softDEF:       Number((c as any).softDEF) || 0,
      weaponATK:     Number((c as any).weaponATK || c.attack) || 0,
      weaponLevel:   Number((c as any).weaponLevel || 1),
      refinementBonus: 0,
      bonusATK:      Number((c as any).bonusATK || 0),
      hit:  175 + cLv + cDEX + Math.floor(cLUK / 3),
      flee: 100 + cLv + cAGI + Math.floor(cLUK / 5) + Math.floor(cLUK / 10),
      critChance: Number((c as any).critChance) || 0,
      critDamage: 0,
      isPlayer: true,
      statusEffects: [],
      isGuarding: false,
      level: cLv,
      // Part 8: tag companion with its grant skill key so on_enter can locate it
      grantSkillKey: (c as any).grantSkillKey,
    } as any);
  }

  // ── Build enemy units ────────────────────────────────────────────────────────────────────
  const enemyUnits: CombatUnit[] = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    enemyUnits.push({
      id: `enemy-${i}`,
      name:    e.name,
      hp:      Number(e.hp)      || 0,
      maxHp:   Number(e.maxHp)   || 0,
      attack:  (e as any).weaponATK ?? e.attack ?? 0,
      defense: (e as any).hardDEF  ?? e.defense ?? 0,
      aspd:    100 + (Number((e as any).agi) || 10) + Math.floor((Number((e as any).dex) || 10) / 4),
      weaponType: (e as any).weaponType,
      str: (e as any).str,
      agi: (e as any).agi,
      vit: (e as any).vit,
      int: (e as any).int,
      dex: (e as any).dex,
      luk: (e as any).luk,
      hardDEF:     (e as any).hardDEF,
      softDEF:     (e as any).softDEF ?? 0,
      weaponATK:   (e as any).weaponATK ?? e.attack ?? 0,
      weaponLevel: (e as any).weaponLevel ?? 1,
      hit:  (e as any).hit,
      flee: (e as any).flee,
      isPlayer: false,
      statusEffects: (e as any).statusEffects ?? [],
      isGuarding: false,
      critChance: 0,
      critDamage: 0,
      level: Number(e.level) || 1,
    } as any);
  }

  units.push(...enemyUnits);

  // ── Pre-combat: on_enter + debuff_aura effects ──────────────────────────────────────────
  applyGrantSkillsOnEnter(units, enemyUnits, ctx, logs);
  applyGrantDebuffAuras(enemyUnits, ctx, logs);

  // seized_ground: +8 defense to player while any horse grant is active
  if (ctx.companionSkillKeys.has("seized_ground") || ctx.horseAspdBonus > 0) {
    const player = units.find((u) => u.id === "player");
    if (player) {
      player.defense  += 8;
      player.hardDEF  = (player.hardDEF  ?? 0) + 8;
      logs.push(`[Seized Ground] Your warhorse braces the line — +8 defense.`);
    }
  }

  // ── Turn loop ────────────────────────────────────────────────────────────────────────────
  let turn = 0;
  const MAX_TURNS = 20;
  // Track whether the previous player action was a miss (for measured_strike)
  let playerLastMissed = false;

  while (turn < MAX_TURNS) {
    turn++;
    logs.push(`--- TURN ${turn} ---`);

    units.sort((a, b) => (b.aspd ?? 0) - (a.aspd ?? 0));

    // veteran_charge: clear the artificial aspd inflation after the first sort
    const player = units.find((u) => u.id === "player");
    if (player && (player as any)._veteranChargeActive) {
      player.aspd = (player.aspd ?? 0) - 9999;
      (player as any)._veteranChargeActive = false;
    }

    for (const unit of units) {
      if (unit.hp <= 0) continue;

      const numAttacks = Math.min(5, Math.max(1, Math.floor((unit.aspd ?? 100) / 100)));

      for (let i = 0; i < numAttacks; i++) {
        const enemiesAlive = units.some(u => !u.isPlayer && u.hp > 0);
        const playerAlive  = units.some(u =>  u.isPlayer && u.hp > 0);
        if (!enemiesAlive || !playerAlive) break;

        const stunIdx = unit.statusEffects.findIndex(s => s.type === "Stun");
        if (stunIdx !== -1) {
          logs.push(`${unit.name} is stunned and skips attack!`);
          unit.statusEffects.splice(stunIdx, 1);
          break;
        }

        const targets = units.filter(u => u.isPlayer !== unit.isPlayer && u.hp > 0);
        if (targets.length === 0) break;

        // taunt_one_hit: redirect this attack to the taunting companion
        let target = targets[Math.floor(Math.random() * targets.length)];
        if (!unit.isPlayer) {
          const taunter = targets.find(t => t.statusEffects.some(s => s.type === "taunt_one_hit"));
          if (taunter) {
            target = taunter;
            const tidx = taunter.statusEffects.findIndex(s => s.type === "taunt_one_hit");
            taunter.statusEffects.splice(tidx, 1);
          }
        }

        // nohimes_eye: bonus flee for the player when they are the target
        const effectiveFlee = target.flee ?? 0;
        const nohimesEyeBonus = getGrantDodgeBonus(target, ctx);
        const hitChance = Math.min(
          95,
          Math.max(
            5,
            calculateHitChance(unit, target) - nohimesEyeBonus,
          ),
        );

        // morale_break: reduce enemy attack this turn
        let attackMultiplier = 1.0;
        if (!unit.isPlayer) {
          const mb = unit.statusEffects.find(s => s.type === "morale_break" && s.duration > 0);
          if (mb) {
            attackMultiplier = 1 - (mb.value ?? 0.06);
            mb.duration--;
            if (mb.duration <= 0) {
              unit.statusEffects.splice(unit.statusEffects.indexOf(mb), 1);
            }
          }
        }

        const hitRoll = Math.random() * 100;
        if (hitRoll > hitChance) {
          logs.push(`${unit.name} attacks ${target.name} but MISSES!`);
          if (unit.id === "player") playerLastMissed = true;
        } else {
          if (unit.id === "player") playerLastMissed = false;

          const isCrit   = (Math.random() * 100) < ((unit.critChance || 0) + 5);
          let   damage   = Math.floor(calculateDamage(unit, target, isCrit) * attackMultiplier);
          target.hp     -= damage;
          logs.push(`${unit.name} attacks ${target.name} for ${damage}${isCrit ? " (CRITICAL!)" : ""} damage.`);

          // on_hit grant skills (player side only)
          if (unit.isPlayer && target.hp > 0) {
            applyGrantSkillsOnHit(unit, target, damage, playerLastMissed, ctx, logs);
          }

          // counter + on_low_hp grant skills (player receives a hit)
          if (!unit.isPlayer && target.id === "player") {
            applyGrantSkillsCounter(unit, target, damage, ctx, logs);
            const hpPct = target.hp / target.maxHp;
            if (hpPct < 0.30) {
              applyGrantSkillsOnLowHp(target, damage, ctx, logs);
            }
          }
        }

        if (unit.name.toLowerCase().includes("ninja") && Math.random() < 0.3) {
          target.statusEffects.push({ type: "Stun", duration: 1 });
          logs.push(`${target.name} was stunned!`);
        }

        if (target.hp <= 0) logs.push(`${target.name} has been KO'd!`);
      }

      const poisonIdx = unit.statusEffects.findIndex(s => s.type === "Poison");
      if (poisonIdx !== -1) {
        const dot = Math.floor(unit.maxHp * 0.05);
        unit.hp  -= dot;
        logs.push(`${unit.name} took ${dot} poison damage.`);
        if (unit.hp <= 0) logs.push(`${unit.name} was defeated by poison!`);
      }

      unit.isGuarding = false;
    }

    const allEnemiesDead = units.every(u => u.isPlayer || u.hp <= 0);
    const allPlayersDead = units.every(u => !u.isPlayer || u.hp <= 0);

    if (allEnemiesDead) {
      logs.push("Victory! All enemies defeated.");
      return {
        victory: true,
        logs,
        turn,
        expMultiplier: getGrantExpMultiplier(ctx),
      };
    }
    if (allPlayersDead) {
      logs.push("Defeat! Your team was wiped out.");
      return {
        victory: false,
        logs,
        turn,
        expMultiplier: getGrantExpMultiplier(ctx),
      };
    }
  }

  logs.push("Timeout! Battle exceeded 20 turns.");
  return {
    victory: false,
    logs,
    turn,
    timeout: true,
    expMultiplier: getGrantExpMultiplier(ctx),
  };
}
