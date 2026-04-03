/**
 * use-player.ts
 * Player data, stats, and stat upgrades.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "./use-toast";

/**
 * Shape of the object returned by GET /api/player.
 * Every column from the `users` table that the API exposes is listed here so
 * that no access site needs an `(player as any)` cast.
 */
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
  // M3 FIX: base stat columns (schema defaults: 10)
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  statPoints: number;
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
  // M3 FIX: progression / onboarding columns
  seppukuCount: number;
  currentChapter: number;
  hasSeenIntro: boolean;
  titleSuffix: string | null;
  activeTitleId: number | null;
}

/**
 * Shape of a single member (player or companion) inside the object returned
 * by GET /api/player/status.  Fields exactly mirror what
 * server/lib/player-stats.ts pushes into the `stats.player` / `stats.companions`
 * objects, so no `(teamStatus.player as any)` cast is ever needed.
 *
 * M4 FIX:
 *  - Removed phantom fields that the server never sends:
 *      statusMATK, softMDEF, endowmentPoints
 *  - Added every real field the server does send:
 *      weaponType, weaponATK, weaponLevel, hardDEF, softDEF, bonusATK,
 *      sp, maxSp, force, influence, spirit,
 *      forceBonusPct, influenceBonusPct, spiritBonusPct,
 *      seppukuCount, statPoints (player-only, optional on companions)
 */
export interface TeamMemberStats {
  id?: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  // Derived primary stats
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  // Weapon metadata
  weaponType?: string;
  weaponATK?: number;
  weaponLevel?: number;
  // Defence breakdown
  hardDEF: number;
  softDEF: number;
  // Hit / evasion
  hit: number;
  flee: number;
  // Crit
  critChance: number;
  critDamage: number;
  bonusATK: number;
  // SP (skill points derived from INT + influence bonus)
  sp?: number;
  maxSp?: number;
  // Thematic stat display (player only, optional on companions)
  force?: number;
  influence?: number;
  spirit?: number;
  forceBonusPct?: number;
  influenceBonusPct?: number;
  spiritBonusPct?: number;
  // Onboarding / identity (player only)
  seppukuCount?: number;
  statPoints?: number;
  // Skills list (companions)
  skills?: string[];
  skill?: string | null;
  // Equipment summary
  equipped?: { name: string; type: string; level: number }[];
  canTransform?: boolean;
}

export interface TeamStats {
  player: TeamMemberStats;
  companions: TeamMemberStats[];
  pet: {
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    skill: string | null;
  } | null;
  horse: {
    name: string;
    level: number;
    speedBonus: number;
    attackBonus: number;
    defenseBonus: number;
    skill: string | null;
  } | null;
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
