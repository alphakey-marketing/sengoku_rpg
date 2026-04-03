/**
 * use-story.ts
 * Story-specific React Query hooks.
 *
 * Uses getQueryFn from queryClient.ts so auth headers are injected
 * correctly in both Supabase and dev modes.
 *
 * getQueryFn() returns a QueryFunction — it must be assigned directly
 * to the queryFn option and NOT called immediately. Calling it inline
 * bypassed React Query's cancellation signal and leaked an AbortController
 * on every render.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { getQueryFn } from "../lib/queryClient";

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
    queryFn: getQueryFn<PlayerFlag[]>({ on401: "returnNull" }),
    staleTime: 30_000,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

export function useStoryChapters() {
  return useQuery<StoryChapter[]>({
    queryKey: [api.story.chapters.path],
    queryFn: getQueryFn<StoryChapter[]>({ on401: "returnNull" }),
    staleTime: 30_000,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}
