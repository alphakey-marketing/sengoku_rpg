/**
 * use-companions.ts
 * Companion queries and mutations.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";

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
  isLocked: boolean;
  lockReason: string | null;
}

export function useCompanions() {
  return useQuery<Companion[]>({
    queryKey: [api.companions.list.path],
    queryFn: () => apiRequest("GET", api.companions.list.path),
  });
}

export function useSetParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companionIds: number[]) =>
      apiRequest("POST", api.companions.setParty.path, { companionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecycleCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (compId: number) =>
      apiRequest("POST", `/api/companions/${compId}/recycle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useUpgradeCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (compId: number) =>
      apiRequest("POST", `/api/companions/${compId}/upgrade`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}
