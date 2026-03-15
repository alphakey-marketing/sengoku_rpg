/**
 * client/src/hooks/use-story.ts
 *
 * Uses the shared apiRequest / getQueryFn from queryClient.ts so that
 * auth headers are injected correctly in BOTH supabase and dev modes.
 * The old private fetchWithAuth (Supabase-only) is removed — it was
 * bypassing the dev-mode `x-dev-user-id` header, causing 401s and
 * the resulting non-array response crashing ContextualTips.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest, getQueryFn } from "../lib/queryClient";

export interface PlayerFlag {
  flagKey: string;
  flagValue: number;
}

/** Shape returned by GET /api/story/chapters (enriched with per-user fields) */
export interface StoryChapter {
  id: number;
  title: string;
  subtitle: string | null;
  chapterOrder: number;
  isLocked: boolean;
  firstSceneId: number | null;
  /** Computed server-side: true when chapterOrder <= currentChapter + 1 */
  isUnlocked: boolean;
  /** Computed server-side: true when the player has a completed progress row */
  isCompleted: boolean;
  /** The player's last saved sceneId for this chapter, or null */
  currentSceneId: number | null;
}

export function useStoryFlags() {
  return useQuery<PlayerFlag[]>({
    queryKey: [api.story.flags.path],
    queryFn: getQueryFn<PlayerFlag[]>({ on401: "returnNull" })({ queryKey: [api.story.flags.path], meta: undefined, signal: new AbortController().signal }),
    staleTime: 30_000,
    // Ensure we always fall back to an empty array, never undefined/null
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

export function useStoryChapters() {
  return useQuery<StoryChapter[]>({
    queryKey: [api.story.chapters.path],
    queryFn: getQueryFn<StoryChapter[]>({ on401: "returnNull" })({ queryKey: [api.story.chapters.path], meta: undefined, signal: new AbortController().signal }),
    staleTime: 30_000,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}
