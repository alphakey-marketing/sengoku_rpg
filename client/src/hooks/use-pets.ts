/**
 * use-pets.ts
 * Pet queries and mutations.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";

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

export function usePets() {
  return useQuery<Pet[]>({
    queryKey: [api.pets.list.path],
    queryFn: () => apiRequest("GET", api.pets.list.path),
  });
}

export function useSetActivePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (petId: number) =>
      apiRequest("POST", buildUrl(api.pets.setActive.path, { id: petId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}

export function useRecyclePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (petId: number) =>
      apiRequest("POST", `/api/pets/${petId}/recycle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
    },
  });
}

export function useUpgradePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      apiRequest("POST", `/api/pets/${id}/upgrade`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}
