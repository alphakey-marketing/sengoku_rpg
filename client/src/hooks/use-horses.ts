/**
 * use-horses.ts
 * Horse queries and mutations.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "./use-toast";

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

export function useHorses() {
  return useQuery<Horse[]>({
    queryKey: [api.horses.list.path],
    queryFn: () => apiRequest("GET", api.horses.list.path),
  });
}

export function useSetActiveHorse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (horseId: number) =>
      apiRequest("POST", buildUrl(api.horses.setActive.path, { id: horseId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.horses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecycleHorse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (horseId: number) =>
      apiRequest("POST", buildUrl(api.horses.recycle.path, { id: horseId })),
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
    mutationFn: (horseIds: number[]) =>
      apiRequest("POST", api.horses.combine.path, { horseIds }),
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
      toast({ title: "Combination Failed", description: error.message, variant: "destructive" });
    },
  });
}
