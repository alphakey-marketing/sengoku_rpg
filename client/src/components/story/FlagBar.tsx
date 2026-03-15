/**
 * FlagBar.tsx
 * Renders a row of coloured badge-pills showing the player's
 * current story flag values.
 */
import { FLAG_LABELS } from "@/lib/story-constants";
import type { StoryFlags } from "@/lib/story-engine";

interface FlagBarProps {
  flags: StoryFlags;
}

export function FlagBar({ flags }: FlagBarProps) {
  const keys = Object.keys(flags);
  if (!keys.length) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {keys.map((k) => {
        const v = flags[k];
        const colour =
          v > 0 ? "bg-green-900/60 border-green-700/60 text-green-300" :
          v < 0 ? "bg-red-900/60 border-red-700/60 text-red-300" :
                  "bg-white/10 border-white/20 text-white/50";
        const display = v > 0 ? `+${v}` : v === 0 ? "±0" : `${v}`;
        return (
          <span key={k} className={`text-xs px-2 py-0.5 rounded-full border ${colour}`}>
            {FLAG_LABELS[k] ?? k} {display}
          </span>
        );
      })}
    </div>
  );
}
