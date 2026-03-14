import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { supabase } from "../lib/supabase";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { credentials: "include", ...options, headers });
}

export interface PlayerFlag {
  flagKey: string;
  flagValue: number;
}

export function useStoryFlags() {
  return useQuery<PlayerFlag[]>({
    queryKey: [api.story.flags.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.story.flags.path);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useStoryChapters() {
  return useQuery<any[]>({
    queryKey: [api.story.chapters.path],
    queryFn: async () => {
      const res = await fetchWithAuth(api.story.chapters.path);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
}
