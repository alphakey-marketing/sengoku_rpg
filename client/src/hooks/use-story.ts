import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Fetches the authenticated player's story flag scores.
 * Returns a Record<flagKey, score> — e.g. { ruthlessness: 3, supernatural_affinity: 1 }.
 * An empty object means the player has made no flag-affecting choices yet.
 */
export function usePlayerFlags() {
  return useQuery<Record<string, number>>({
    queryKey: ["/api/story/flags"],
    queryFn:  async () => {
      const res = await apiRequest("GET", "/api/story/flags");
      return res.json();
    },
    staleTime: 30_000,
    retry:     false,
  });
}
