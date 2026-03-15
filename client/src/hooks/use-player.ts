/**
 * use-player.ts
 * Player data, stats, and stat upgrades.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "./use-toast";

export interface PlayerData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  level: number;
  experience: number;
  gold: number;
  rice: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  stamina: number;
  maxStamina: number;
  currentLocationId: number;
  activeTransformId: number | null;
  transformActiveUntil: string | null;
  transformationStones: number;
  upgradeStones: number;
  endowmentStones: number;
  fireGodTalisman: number;
  flameEmperorTalisman: number;
  petEssence: number;
  warriorSouls: number;
  statPoints: number;
}

export interface TeamMemberStats {
  id?: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  hit: number;
  flee: number;
  statusMATK: number;
  softMDEF: number;
  maxSp: number;
  critChance: number;
  critDamage: number;
  endowmentPoints: number;
  skill?: string | null;
  equipped?: { name: string; type: string; level: number }[];
  canTransform?: boolean;
}

export interface TeamStats {
  player: TeamMemberStats;
  companions: TeamMemberStats[];
  pet: { name: string; level: number; hp: number; maxHp: number; attack: number; defense: number; speed: number; skill: string | null } | null;
  horse: { name: string; level: number; speedBonus: number; attackBonus: number; defenseBonus: number; skill: string | null } | null;
}

export function usePlayer() {
  return useQuery<PlayerData>({
    queryKey: [api.player.get.path],
    queryFn: () => apiRequest("GET", api.player.get.path),
    retry: 1,
    retryDelay: 800,
  });
}

export function usePlayerFullStatus() {
  return useQuery<TeamStats>({
    queryKey: [api.player.fullStatus.path],
    queryFn: () => apiRequest("GET", api.player.fullStatus.path),
  });
}

export function useUpgradeStat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (stat: "str" | "agi" | "vit" | "int" | "dex" | "luk") =>
      apiRequest("POST", api.stats.upgrade.path, { stat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Stat Point Allocation Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useBulkUpgradeStats() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (upgrades: Record<string, number>) =>
      apiRequest("POST", api.stats.bulkUpgrade.path, { upgrades }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
      toast({ title: "Stats Saved", description: "Your attributes have been permanently increased." });
    },
    onError: (error: Error) => {
      toast({ title: "Bulk Upgrade Failed", description: error.message, variant: "destructive" });
    },
  });
}
