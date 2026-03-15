import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "./use-toast";
import { supabase } from "../lib/supabase";

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

export interface Companion {
  id: number;
  userId: string;
  name: string;
  type: string;
  rarity: string;
  level: number;
  experience: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  skill: string | null;
  isInParty: boolean;
  isSpecial: boolean;
  // ── A2: loyalty gate (computed server-side, never the raw condition string) ──
  /** true when the companion's flagUnlockCondition is not yet satisfied */
  isLocked: boolean;
  /** Human-readable requirement hint, e.g. "Loyalty Hanzo >= 3 (currently 1)". null when unlocked. */
  lockReason: string | null;
}

export interface Equipment {
  id: number;
  userId: string;
  name: string;
  type: string;
  weaponType: string | null;
  level: number;
  experience: number;
  expToNext: number;
  attackBonus: number;
  defenseBonus: number;
  speedBonus: number;
  critChance: number;
  critDamage: number;
  endowmentPoints: number;
  isEquipped: boolean;
  equippedToId: number | null;
  equippedToType: string | null;
}

export interface Pet {
  id: number;
  userId: string;
  name: string;
  type: string;
  rarity: string;
  level: number;
  experience: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  skill: string | null;
  isActive: boolean;
}

export interface Horse {
  id: number;
  userId: string;
  name: string;
  rarity: string;
  level: number;
  speedBonus: number;
  attackBonus: number;
  defenseBonus: number;
  skill: string | null;
  isActive: boolean;
}

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

export interface GachaResult {
  companion: Companion;
}

/** Attach the current Supabase Bearer token to every game API request. */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { credentials: "include", ...options, headers });
}

export function usePlayer() {
  return useQuery<PlayerData>({
    queryKey: [api.player.get.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.player.get.path);
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch player data");
      return res.json();
    },
    retry: 1,
    retryDelay: 800,
  });
}

export function usePlayerFullStatus() {
  return useQuery<TeamStats>({
    queryKey: [api.player.fullStatus.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.player.fullStatus.path);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
  });
}

export function useCompanions() {
  return useQuery<Companion[]>({
    queryKey: [api.companions.list.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.companions.list.path);
      if (!res.ok) throw new Error("Failed to fetch companions");
      return res.json();
    },
  });
}

export function useSetParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (companionIds: number[]) => {
      const res = await fetchWithAuth(api.companions.setParty.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to set party");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecycleCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (compId: number) => {
      const res = await fetchWithAuth(`/api/companions/${compId}/recycle`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to dismiss companion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useUpgradeCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (compId: number) => {
      const res = await fetchWithAuth(`/api/companions/${compId}/upgrade`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to upgrade companion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: [api.equipment.list.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.equipment.list.path);
      if (!res.ok) throw new Error("Failed to fetch equipment");
      return res.json();
    },
  });
}

export function useEquip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ equipmentId, equippedToId, equippedToType }: { equipmentId: number; equippedToId: number | null; equippedToType: string }) => {
      const url = buildUrl(api.equipment.equip.path, { id: equipmentId });
      const res = await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equippedToId, equippedToType }),
      });
      if (!res.ok) throw new Error("Failed to equip item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useUnequip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (equipmentId: number) => {
      const url = buildUrl(api.equipment.unequip.path, { id: equipmentId });
      const res = await fetchWithAuth(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to unequip");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecycleEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (equipmentId: number) => {
      const url = buildUrl(api.equipment.recycle.path, { id: equipmentId });
      const res = await fetchWithAuth(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to recycle");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useUpgradeEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) => {
      const url = buildUrl(api.equipment.upgrade.path, { id });
      const res = await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error("Failed to upgrade");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function usePets() {
  return useQuery<Pet[]>({
    queryKey: [api.pets.list.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.pets.list.path);
      if (!res.ok) throw new Error("Failed to fetch pets");
      return res.json();
    },
  });
}

export function useSetActivePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (petId: number) => {
      const url = buildUrl(api.pets.setActive.path, { id: petId });
      const res = await fetchWithAuth(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to set active pet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecyclePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (petId: number) => {
      const res = await fetchWithAuth(`/api/pets/${petId}/recycle`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to recycle pet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useUpgradePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) => {
      const res = await fetchWithAuth(`/api/pets/${id}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error("Failed to upgrade pet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useHorses() {
  return useQuery<Horse[]>({
    queryKey: [api.horses.list.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.horses.list.path);
      if (!res.ok) throw new Error("Failed to fetch horses");
      return res.json();
    },
  });
}

export function useSetActiveHorse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (horseId: number) => {
      const url = buildUrl(api.horses.setActive.path, { id: horseId });
      const res = await fetchWithAuth(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to set active horse");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.horses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecycleHorse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (horseId: number) => {
      const url = buildUrl(api.horses.recycle.path, { id: horseId });
      const res = await fetchWithAuth(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to recycle horse");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.horses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useCombineHorses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (horseIds: number[]) => {
      const res = await fetchWithAuth(api.horses.combine.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horseIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to combine horses");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.horses.list.path] });
      toast({
        title: data.upgraded ? "Upgrade Success!" : "Combination Complete",
        description: data.upgraded
          ? `You obtained a higher rarity horse: ${data.newHorse.name}!`
          : `You obtained a same rarity horse: ${data.newHorse.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Combination Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useTransformations() {
  return useQuery<Transformation[]>({
    queryKey: [api.transformations.list.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.transformations.list.path);
      if (!res.ok) throw new Error("Failed to fetch transformations");
      return res.json();
    },
  });
}

export function useFieldBattle() {
  const queryClient = useQueryClient();
  return useMutation<BattleResult, Error, number | { locationId: number; repeatCount: number }>({
    mutationFn: async (params) => {
      const body = typeof params === "number" ? { locationId: params } : params;
      const res = await fetchWithAuth(api.battle.field.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Battle failed");
      return res.json();
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
    mutationFn: async (locationId: number) => {
      const res = await fetchWithAuth(api.battle.boss.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) throw new Error("Boss battle failed");
      return res.json();
    },
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
    mutationFn: async (locationId: number) => {
      const res = await fetchWithAuth(api.battle.specialBoss.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) throw new Error("Special boss battle failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transformations.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useCampaignEvents() {
  return useQuery<any[]>({
    queryKey: [api.campaign.events.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.campaign.events.path);
      if (!res.ok) throw new Error("Failed to fetch campaign events");
      return res.json();
    },
  });
}

export function useTriggerCampaignEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventKey, choice }: { eventKey: string; choice?: string }) => {
      const res = await fetchWithAuth(api.campaign.triggerEvent.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey, choice }),
      });
      if (!res.ok) throw new Error("Failed to trigger campaign event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.campaign.events.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useGachaPull() {
  const queryClient = useQueryClient();
  return useMutation<GachaResult, Error, { isSpecial?: boolean; count?: number } | void>({
    mutationFn: async (params) => {
      const body = params || {};
      const res = await fetchWithAuth(api.gacha.pull.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Gacha pull failed. Not enough rice?");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
    },
  });
}

export function useEquipmentGachaPull() {
  const queryClient = useQueryClient();
  return useMutation<{ equipment: Equipment[] }, Error, { count?: number } | void>({
    mutationFn: async (params) => {
      const body = params || {};
      const res = await fetchWithAuth(api.gacha.pullEquipment.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Equipment pull failed. Not enough rice?");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
    },
  });
}

export function useEndowEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, type, protect }: { id: number; type: string; protect?: boolean }) => {
      const res = await fetchWithAuth(`/api/equipment/${id}/endow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, protect }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Endowment failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
      toast({
        title: data.success ? "Endowment Success!" : "Endowment Failed",
        description: data.success
          ? `Added ${data.pointsGained} points. Total: ${data.newPoints}`
          : `Lost points. Total: ${data.newPoints}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpgradeStat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (stat: "str" | "agi" | "vit" | "int" | "dex" | "luk") => {
      const res = await fetchWithAuth(api.stats.upgrade.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stat }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to upgrade stat");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
    onError: (error: Error) => {
      toast({
        title: "Stat Point Allocation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useBulkUpgradeStats() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (upgrades: Record<string, number>) => {
      const res = await fetchWithAuth(api.stats.bulkUpgrade.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgrades }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to upgrade stats");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
      toast({
        title: "Stats Saved",
        description: "Your attributes have been permanently increased.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
