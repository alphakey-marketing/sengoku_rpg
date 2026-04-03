/**
 * use-battle.ts
 * Field battle, boss battle, and special-boss battle mutations.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import type { Equipment } from "./use-equipment";
import type { Pet }       from "./use-pets";
import type { Horse }     from "./use-horses";
import type { TeamStats } from "./use-player";

export interface Transformation {
  id: number;
  userId: string;
  name: string;
  level: number;
  experience: number;
  expToNext: number;
  attackPercent: number;
  defensePercent: number;
  speedPercent: number;
  hpPercent: number;
  skill: string;
  cooldownSeconds: number;
  durationSeconds: number;
}

export interface EnemyStats {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  skills: string[];
  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  dex?: number;
  luk?: number;
  weaponATK?: number;
  weaponLevel?: number;
  hardDEF?: number;
  softDEF?: number;
  hit?: number;
  flee?: number;
  stamina?: number;
  maxStamina?: number;
}

/**
 * Shape of the object returned by every battle route.
 *
 * M5 FIX: renamed `experienceGained` → `expGained` to match the key
 * used in server/routes/battle.ts (all four battle handlers return
 * { expGained, goldGained, ... }).  The old name was never populated,
 * causing XP gain to always read as `undefined` in the UI.
 */
export interface BattleResult {
  victory: boolean;
  /** XP awarded this battle (key matches server response). */
  expGained: number;
  goldGained: number;
  riceGained?: number;
  equipmentDropped?: Equipment[];
  petDropped?: Pet;
  horseDropped?: Horse;
  transformationDropped?: Transformation;
  equipmentExpGained?: number;
  logs: string[];
  playerTeam?: TeamStats;
  enemyTeam?: { enemies: EnemyStats[] };
  /** Ninja encounter forwarded from field-battle repeat logic. */
  ninjaEncounter?: EnemyStats;
}

export function useFieldBattle() {
  const queryClient = useQueryClient();
  return useMutation<BattleResult, Error, number | { locationId: number; repeatCount: number }>({
    mutationFn: (params) => {
      const body = typeof params === "number" ? { locationId: params } : params;
      return apiRequest("POST", api.battle.field.path, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.horses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useBossBattle() {
  const queryClient = useQueryClient();
  return useMutation<BattleResult, Error, number>({
    mutationFn: (locationId: number) =>
      apiRequest("POST", api.battle.boss.path, { locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useSpecialBossBattle() {
  const queryClient = useQueryClient();
  return useMutation<BattleResult, Error, number>({
    mutationFn: (locationId: number) =>
      apiRequest("POST", api.battle.specialBoss.path, { locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transformations.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}
