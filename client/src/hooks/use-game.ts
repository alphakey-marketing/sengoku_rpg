/**
 * use-game.ts  —  re-export barrel
 * ─────────────────────────────────────────────────────────────────────────────
 * All domain-specific hooks and types have been split into focused files:
 *
 *   use-player.ts          usePlayer, usePlayerFullStatus, useUpgradeStat,
 *                          useBulkUpgradeStats, PlayerData, TeamStats, TeamMemberStats
 *   use-companions.ts      useCompanions, useSetParty, useRecycleCompanion,
 *                          useUpgradeCompanion, Companion
 *   use-equipment.ts       useEquipment, useEquip, useUnequip, useRecycleEquipment,
 *                          useUpgradeEquipment, useEndowEquipment,
 *                          useEquipmentGachaPull, Equipment
 *   use-pets.ts            usePets, useSetActivePet, useRecyclePet,
 *                          useUpgradePet, Pet
 *   use-horses.ts          useHorses, useSetActiveHorse, useRecycleHorse,
 *                          useCombineHorses, Horse
 *   use-battle.ts          useFieldBattle, useBossBattle, useSpecialBossBattle,
 *                          BattleResult, EnemyStats, Transformation
 *   use-gacha.ts           useGachaPull, GachaResult
 *   use-transformations.ts useTransformations, useCampaignEvents,
 *                          useTriggerCampaignEvent
 *   use-grants.ts          usePlayerGrants, PlayerGrant, GrantsByCategory  (Part 10)
 *
 * This file re-exports everything so all existing import sites continue to
 * work without any changes.
 */

export * from "./use-player";
export * from "./use-companions";
export * from "./use-equipment";
export * from "./use-pets";
export * from "./use-horses";
export * from "./use-battle";
export * from "./use-gacha";
export * from "./use-transformations";
export * from "./use-grants";
