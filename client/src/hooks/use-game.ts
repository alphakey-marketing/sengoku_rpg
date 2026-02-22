import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

// Types derived from schema context
export interface PlayerData {
  id: string;
  username: string;
  level: number;
  experience: number;
  gold: number;
  rice: number;
  attack: number;
  defense: number;
  currentLocationId: number;
}

export interface Companion {
  id: number;
  userId: string;
  name: string;
  type: string;
  rarity: number;
  level: number;
  attack: number;
  defense: number;
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
  attackBonus: number;
  defenseBonus: number;
  isEquipped: boolean;
  equippedToId: number | null;
}

export interface BattleResult {
  victory: boolean;
  experienceGained: number;
  goldGained: number;
  equipmentDropped?: Equipment[];
  logs: string[];
}

export interface GachaResult {
  companion: Companion;
}

// ----------------- HOOKS -----------------

export function usePlayer() {
  return useQuery<PlayerData>({
    queryKey: [api.player.get.path],
    queryFn: async () => {
      const res = await fetch(api.player.get.path, { credentials: "include" });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch player data");
      return res.json();
    },
  });
}

export function useCompanions() {
  return useQuery<Companion[]>({
    queryKey: [api.companions.list.path],
    queryFn: async () => {
      const res = await fetch(api.companions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch companions");
      return res.json();
    },
  });
}

export function useSetParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (companionIds: number[]) => {
      const res = await fetch(api.companions.setParty.path, {
        method: api.companions.setParty.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to set party");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
    },
  });
}

export function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: [api.equipment.list.path],
    queryFn: async () => {
      const res = await fetch(api.equipment.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch equipment");
      return res.json();
    },
  });
}

export function useEquip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ equipmentId, equippedToId }: { equipmentId: number, equippedToId: number | null }) => {
      const url = buildUrl(api.equipment.equip.path, { id: equipmentId });
      const res = await fetch(url, {
        method: api.equipment.equip.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equippedToId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to equip item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] }); // Stats might change
    },
  });
}

export function useFieldBattle() {
  const queryClient = useQueryClient();
  return useMutation<BattleResult, Error, number>({
    mutationFn: async (locationId: number) => {
      const res = await fetch(api.battle.field.path, {
        method: api.battle.field.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Battle failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
    },
  });
}

export function useBossBattle() {
  const queryClient = useQueryClient();
  return useMutation<BattleResult, Error, number>({
    mutationFn: async (locationId: number) => {
      const res = await fetch(api.battle.boss.path, {
        method: api.battle.boss.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Boss battle failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
    },
  });
}

export function useGachaPull() {
  const queryClient = useQueryClient();
  return useMutation<GachaResult, Error, void>({
    mutationFn: async () => {
      const res = await fetch(api.gacha.pull.path, {
        method: api.gacha.pull.method,
        credentials: "include",
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
