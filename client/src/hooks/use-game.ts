import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
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
  upgradeStones: number;
  endowmentStones: number;
  fireGodTalisman: number;
  flameEmperorTalisman: number;
  petEssence: number;
  warriorSouls: number;
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
}

export interface Equipment {
  id: number;
  userId: string;
  name: string;
  type: string;
  rarity: string;
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
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  skill?: string | null;
  equipped?: { name: string; type: string; level: number; rarity: string }[];
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

function fetchWithAuth(url: string, options?: RequestInit) {
  return fetch(url, { credentials: "include", ...options });
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
    mutationFn: async (equipmentId: number) => {
      const url = buildUrl(api.equipment.upgrade.path, { id: equipmentId });
      const res = await fetchWithAuth(url, { method: "POST" });
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
    mutationFn: async (petId: number) => {
      const res = await fetchWithAuth(`/api/pets/${petId}/upgrade`, { method: "POST" });
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
      const body = typeof params === 'number' ? { locationId: params } : params;
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
  return useMutation<GachaResult, Error, void>({
    mutationFn: async () => {
      const res = await fetchWithAuth(api.gacha.pull.path, { method: "POST" });
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
  return useMutation<{ equipment: Equipment }, Error, void>({
    mutationFn: async () => {
      const res = await fetchWithAuth(api.gacha.pullEquipment.path, { method: "POST" });
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
    mutationFn: async ({ id, type, protect }: { id: number, type: string, protect?: boolean }) => {
      const res = await fetch(`/api/equipment/${id}/endow`, {
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
    }
  });
}
