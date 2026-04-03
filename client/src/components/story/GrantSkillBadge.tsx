/**
 * GrantSkillBadge.tsx  (Sprint 3 — 3c)
 *
 * Renders the ✦ amber "Story-granted" pill badge on inventory cards.
 * Tooltip expands from static "Story-granted" to contextual:
 *   "Granted after Chapter N — [chapter title]"
 *
 * Data: cached /api/story/grants query + CHAPTER_CATALOGUE lookup.
 * Zero new API surface.
 *
 * Chapter derivation: grantKey prefix "ch2_foo" → chapter 2.
 * Falls back to "Story-granted skill" if unresolvable.
 */

import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { CHAPTER_CATALOGUE } from "@/lib/story-constants";
import type { PlayerGrant } from "@/hooks/use-grants";

interface GrantSkillBadgeProps {
  grantKey: string;
  className?: string;
}

export function GrantSkillBadge({ grantKey, className = "" }: GrantSkillBadgeProps) {
  const { data: grants } = useQuery<PlayerGrant[]>({
    queryKey: ["/api/story/grants"],
    queryFn:  () => apiRequest("GET", "/api/story/grants"),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });

  const tooltipText = (() => {
    if (!grants) return "Story-granted skill";
    const grant = grants.find((g) => g.grantKey === grantKey);
    if (!grant) return "Story-granted skill";
    const m = grant.grantKey.match(/^ch(\d+)_/);
    const n = m ? parseInt(m[1], 10) : null;
    if (n === null) return "Story-granted skill";
    const entry = CHAPTER_CATALOGUE.find((c) => c.id === n);
    if (!entry) return `Granted after Chapter ${n}`;
    return `Granted after Chapter ${n} — ${entry.title}`;
  })();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`
              inline-flex items-center gap-1
              px-1.5 py-0.5 rounded
              text-[10px] font-semibold tracking-wide
              bg-amber-900/40 text-amber-400
              border border-amber-700/40
              cursor-default select-none
              ${className}
            `}
          >
            ✦ Story
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px] text-center leading-snug">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
