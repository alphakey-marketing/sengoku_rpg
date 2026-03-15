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

export interface BattleResult {
  victory: boolean;
  experienceGained: number;
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
