/**
 * use-gacha.ts
 * Companion gacha pull. Equipment gacha lives in use-equipment.ts.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "../lib/queryClient";
import type { Companion } from "./use-companions";

export interface GachaResult {
  companion: Companion;
}

export function useGachaPull() {
  const queryClient = useQueryClient();
  return useMutation<GachaResult, Error, { isSpecial?: boolean; count?: number } | void>({
    mutationFn: (params) =>
      apiRequest("POST", api.gacha.pull.path, params ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
    },
  });
}
