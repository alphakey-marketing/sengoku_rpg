/**
 * GrantOriginPanel.tsx  — Sprint 5 (4b)
 *
 * Collapsible inline panel shown below GrantSkillBadge on companion,
 * pet, and horse inventory cards.  Displays full grant provenance:
 *
 *   ▶ Story Origin                     ← click to expand
 *   ──────────────────────────────────
 *   Grant key:  ch2_nohime_sword
 *   Skill:      Blade of the Vow
 *   Flavour:    "Take this blade…"
 *   Awarded:    Chapter 2 — The Alliance of Wolves
 *
 * Props
 * ─────
 *   grant    — PlayerGrant  (required)
 *
 * Usage (party.tsx, pets.tsx, stable.tsx)
 * ───────────────────────────────────────
 *   {!isLocked && grant && (
 *     <>
 *       <GrantSkillBadge label={...} flavour={grant.flavourText} />
 *       <GrantOriginPanel grant={grant} />
 *     </>
 *   )}
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { resolveGrantSkillLabel, type PlayerGrant } from "@/hooks/use-grants";
import { CHAPTER_CATALOGUE } from "@/lib/story-constants";

function chapterTitle(n: number): string {
  return CHAPTER_CATALOGUE.find((c) => c.id === n)?.title ?? `Chapter ${n}`;
}

interface GrantOriginPanelProps {
  grant: PlayerGrant;
}

export function GrantOriginPanel({ grant }: GrantOriginPanelProps) {
  const [open, setOpen] = useState(false);
  const skillLabel = resolveGrantSkillLabel(grant);
  const ch         = grant.awardedAtChapter;
  const chapTitle  = chapterTitle(ch);

  return (
    <div className="mt-1">
      {/* toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] text-stone-500
                   hover:text-amber-400 transition-colors uppercase tracking-wider font-bold"
      >
        {open
          ? <ChevronDown  size={10} />
          : <ChevronRight size={10} />}
        Story Origin
      </button>

      {open && (
        <div className="mt-1.5 p-3 rounded-lg border border-amber-700/25
                        bg-amber-950/15 text-xs space-y-1.5">
          {/* awarded chapter */}
          <div className="flex items-start gap-2">
            <BookOpen size={11} className="text-amber-500 mt-0.5 shrink-0" />
            <span className="text-stone-300">
              Granted after{" "}
              <span className="text-amber-400 font-semibold">
                Chapter {ch} — {chapTitle}
              </span>
            </span>
          </div>
          {/* skill name */}
          <div className="text-stone-400">
            <span className="text-stone-500 uppercase tracking-wider font-bold text-[9px] mr-1">Skill</span>
            {skillLabel}
          </div>
          {/* flavour */}
          {grant.flavourText && (
            <p className="text-stone-500 italic leading-snug">“{grant.flavourText}”</p>
          )}
          {/* grant key */}
          <div className="text-stone-600 font-mono text-[9px] pt-0.5 border-t border-white/5">
            {grant.grantKey}
          </div>
        </div>
      )}
    </div>
  );
}
