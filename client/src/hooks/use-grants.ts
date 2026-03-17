/**
 * use-grants.ts  (Part 10/10 + Sprint 2)
 *
 * React Query hook for the player's active story-grant skills.
 *
 * Sprint 2 additions
 * ──────────────────
 *  • PlayerGrant.awardedAt  — ISO timestamp forwarded from the server
 *  • useNewGrants()         — grants awarded in the last 24 h that the
 *                             player hasn't yet "seen" (per localStorage)
 *  • markGrantSeen()        — writes gameRowId to the seen set and
 *                             triggers a re-render in all consumers
 *  • newGrantsByCategory()  — breakdown of unseen grants by category;
 *                             used by the nav badge dot (3b) and the
 *                             NewGrantRing wrapper (3a)
 *
 * localStorage key
 * ────────────────
 *  "sengoku_seen_grants"  →  JSON array of number (gameRowId)
 *  Written by markGrantSeen(); read by useNewGrants().
 *  Cleared automatically when a grant ages past the 24-hour window.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { apiRequest } from "../lib/queryClient";
import { getSkillDescription } from "@shared/skill-descriptions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerGrant {
  id:            number;
  grantKey:      string;
  displayName:   string;
  flavourText:   string | null;
  grantCategory: string;
  rarity:        string;
  gameRowId:     number | null;
  isSuperseded:  boolean;
  /** ISO-8601 timestamp — present in the server response from Part 5 */
  awardedAt:     string;
}

export interface GrantsByCategory {
  companionGrants: PlayerGrant[];
  equipmentGrants: PlayerGrant[];
  petGrants:       PlayerGrant[];
  horseGrants:     PlayerGrant[];
  allGrants:       PlayerGrant[];
}

export interface NewGrantsByCategory {
  companion: PlayerGrant[];
  equipment: PlayerGrant[];
  pet:       PlayerGrant[];
  horse:     PlayerGrant[];
  total:     number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRANTS_QUERY_KEY  = ["/api/story/grants"] as const;
const SEEN_GRANTS_KEY   = "sengoku_seen_grants";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ── localStorage helpers ──────────────────────────────────────────────────────

function readSeenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_GRANTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<number>): void {
  try {
    localStorage.setItem(SEEN_GRANTS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — fail silently; badge dot will re-appear
  }
}

// ── Primary hook ─────────────────────────────────────────────────────────────

export function usePlayerGrants(): GrantsByCategory & { isLoading: boolean } {
  const { data, isLoading } = useQuery<PlayerGrant[]>({
    queryKey: GRANTS_QUERY_KEY,
    queryFn:  () => apiRequest("GET", "/api/story/grants"),
    staleTime: 5 * 60 * 1000,
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

// ── Sprint 2: new-grant detection ─────────────────────────────────────────────

/**
 * Returns grants that:
 *  1. Are not superseded
 *  2. Were awarded within the last 24 hours
 *  3. Have NOT been marked as seen via markGrantSeen()
 *
 * The result is memoised on the raw query data so referential identity
 * is stable across re-renders (safe to use in useEffect dependency arrays).
 */
export function useNewGrants(): NewGrantsByCategory {
  const { data } = useQuery<PlayerGrant[]>({
    queryKey: GRANTS_QUERY_KEY,
    queryFn:  () => apiRequest("GET", "/api/story/grants"),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });

  return useMemo(() => {
    const now     = Date.now();
    const seenIds = readSeenIds();

    const unseen = (data ?? []).filter((g) => {
      if (g.isSuperseded)            return false;
      if (g.gameRowId === null)      return false;
      if (seenIds.has(g.gameRowId))  return false;
      const age = now - new Date(g.awardedAt).getTime();
      return age < TWENTY_FOUR_HOURS;
    });

    const companion = unseen.filter((g) => g.grantCategory === "companion");
    const equipment = unseen.filter((g) => g.grantCategory === "equipment");
    const pet       = unseen.filter((g) => g.grantCategory === "pet");
    const horse     = unseen.filter((g) => g.grantCategory === "horse");

    return {
      companion,
      equipment,
      pet,
      horse,
      total: companion.length + equipment.length + pet.length + horse.length,
    };
  }, [data]);
}

/**
 * Marks a grant card as "seen" so the amber pulse ring and nav badge dot
 * are cleared for that specific item.  Safe to call multiple times with
 * the same id — idempotent.
 *
 * Pass the companion/equipment/pet/horse row id (PlayerGrant.gameRowId).
 *
 * The function also calls queryClient.invalidateQueries for the grants
 * key so any component using useNewGrants() re-renders immediately after
 * the localStorage write, without waiting for the 5-minute staleTime.
 */
export function useMarkGrantSeen() {
  const queryClient = useQueryClient();

  return useCallback((gameRowId: number) => {
    const ids = readSeenIds();
    if (ids.has(gameRowId)) return; // already seen — skip re-render
    ids.add(gameRowId);
    writeSeenIds(ids);
    // Force useNewGrants() consumers to re-evaluate the filtered list
    queryClient.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
  }, [queryClient]);
}

// ── Skill label helper ────────────────────────────────────────────────────────

/**
 * Looks up the human-readable skill name for a grant key.
 * Returns the displayName as fallback if skill-descriptions.ts has no entry.
 */
export function resolveGrantSkillLabel(grant: PlayerGrant): string {
  const desc = getSkillDescription(grant.grantKey);
  return desc?.name ?? grant.displayName;
}
