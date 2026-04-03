/**
 * use-equipment.ts
 * Equipment queries and mutations (equip, unequip, upgrade, recycle, endow, gacha pull).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "./use-toast";

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

export function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: [api.equipment.list.path],
    queryFn: () => apiRequest("GET", api.equipment.list.path),
  });
}

export function useEquip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ equipmentId, equippedToId, equippedToType }: {
      equipmentId: number;
      equippedToId: number | null;
      equippedToType: string;
    }) => apiRequest("POST", buildUrl(api.equipment.equip.path, { id: equipmentId }), { equippedToId, equippedToType }),
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
    mutationFn: (equipmentId: number) =>
      apiRequest("POST", buildUrl(api.equipment.unequip.path, { id: equipmentId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecycleEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (equipmentId: number) =>
      apiRequest("POST", buildUrl(api.equipment.recycle.path, { id: equipmentId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useUpgradeEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      apiRequest("POST", buildUrl(api.equipment.upgrade.path, { id }), { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useEndowEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, type, protect }: { id: number; type: string; protect?: boolean }) =>
      apiRequest("POST", `/api/equipment/${id}/endow`, { type, protect }),
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
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useEquipmentGachaPull() {
  const queryClient = useQueryClient();
  return useMutation<{ equipment: Equipment[] }, Error, { count?: number } | void>({
    mutationFn: (params) =>
      apiRequest("POST", api.gacha.pullEquipment.path, params ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
    },
  });
}
