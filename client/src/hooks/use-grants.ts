/**
 * use-grants.ts  (Part 10/10)
 *
 * React Query hook for the player's active story-grant skills.
 *
 * Calls GET /api/story/grants which returns the list built by
 * evaluateGrants (Parts 1-7).  The hook is intentionally lightweight:
 * it fetches once on mount and every 5 minutes in the background so
 * the grant badges on card panels stay fresh without hammering the API.
 *
 * Exported types
 * ──────────────
 *  PlayerGrant        — mirrors the IssuedGrant shape from GrantRewardPopup
 *  GrantsByCategory   — {companion, equipment, pet, horse} → PlayerGrant[]
 *
 * Usage
 * ─────
 *  const { companionGrants, horseGrants, petGrants } = usePlayerGrants();
 *
 *  // Does this companion have a story skill?
 *  const grant = companionGrants.find(g => g.gameRowId === comp.id);
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { getSkillDescription } from "@shared/skill-descriptions";

export interface PlayerGrant {
  id:            number;
  grantKey:      string;
  displayName:   string;
  flavourText:   string | null;
  grantCategory: string;
  rarity:        string;
  gameRowId:     number | null;
  isSuperseded:  boolean;
}

export interface GrantsByCategory {
  companionGrants: PlayerGrant[];
  equipmentGrants: PlayerGrant[];
  petGrants:       PlayerGrant[];
  horseGrants:     PlayerGrant[];
  allGrants:       PlayerGrant[];
}

const GRANTS_QUERY_KEY = ["/api/story/grants"] as const;

export function usePlayerGrants(): GrantsByCategory & { isLoading: boolean } {
  const { data, isLoading } = useQuery<PlayerGrant[]>({
    queryKey: GRANTS_QUERY_KEY,
    queryFn:  () => apiRequest("GET", "/api/story/grants"),
    staleTime: 5 * 60 * 1000,   // 5 min — grant list changes only on chapter complete
    gcTime:    10 * 60 * 1000,
  });

  const active = (data ?? []).filter((g) => !g.isSuperseded);

  return {
    isLoading,
    allGrants:       active,
    companionGrants: active.filter((g) => g.grantCategory === "companion"),
    equipmentGrants: active.filter((g) => g.grantCategory === "equipment"),
    petGrants:       active.filter((g) => g.grantCategory === "pet"),
    horseGrants:     active.filter((g) => g.grantCategory === "horse"),
  };
}

/**
 * Looks up the human-readable skill name for a grant key.
 * Returns the displayName as fallback if skill-descriptions.ts has no entry.
 */
export function resolveGrantSkillLabel(grant: PlayerGrant): string {
  const desc = getSkillDescription(grant.grantKey);
  return desc?.name ?? grant.displayName;
}
