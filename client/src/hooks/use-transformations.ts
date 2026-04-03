/**
 * use-transformations.ts
 * Transformation queries. Campaign events also live here because
 * they share the same thematic domain (field/campaign actions).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import type { Transformation } from "./use-battle";

export function useTransformations() {
  return useQuery<Transformation[]>({
    queryKey: [api.transformations.list.path],
    queryFn: () => apiRequest("GET", api.transformations.list.path),
  });
}

export function useCampaignEvents() {
  return useQuery<any[]>({
    queryKey: [api.campaign.events.path],
    queryFn: () => apiRequest("GET", api.campaign.events.path),
  });
}

export function useTriggerCampaignEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventKey, choice }: { eventKey: string; choice?: string }) =>
      apiRequest("POST", api.campaign.triggerEvent.path, { eventKey, choice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.campaign.events.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.pets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
    },
  });
}
