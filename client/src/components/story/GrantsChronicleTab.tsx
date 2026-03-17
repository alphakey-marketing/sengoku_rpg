/**
 * GrantsChronicleTab.tsx  — Sprint 5 (4a)
 *
 * A full-width timeline of every active story grant the player has earned,
 * grouped by chapter and then split by category.
 *
 * Rendered inside ChapterSelectHub when the player clicks the "Grants"
 * tab.  Falls back to an empty-state CTA when no grants are present.
 *
 * Layout
 * ──────
 *   Chapter 1 — The Fool of Owari         ← collapsible chapter header
 *     ⚔ Companion  │  🐾 Pet  │  🏇 Horse  │  🛡 Equipment
 *     [card] [card]  …
 *   Chapter 2 — …
 *
 * Each card shows:
 *   • Rarity dot + category icon
 *   • displayName (bold)
 *   • flavourText (italic, muted)
 *   • "Ch N · <chapter title>" label bottom-right
 *
 * Data source: usePlayerGrants() — already cached, no extra fetch.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { usePlayerGrants, resolveGrantSkillLabel, type PlayerGrant } from "@/hooks/use-grants";
import { CHAPTER_CATALOGUE } from "@/lib/story-constants";
import { Sparkles, ChevronDown, ChevronRight, Users, Shield, PawPrint, Swords } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  companion: <Users  size={11} />,
  equipment: <Shield size={11} />,
  pet:       <PawPrint size={11} />,
  horse:     <Swords size={11} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  companion: "Companion",
  equipment: "Equipment",
  pet:       "Spirit Beast",
  horse:     "War Horse",
};

const RARITY_DOT: Record<string, string> = {
  legendary: "bg-orange-400",
  epic:      "bg-purple-400",
  rare:      "bg-blue-400",
  uncommon:  "bg-green-400",
  common:    "bg-zinc-400",
};

function chapterTitle(chapterNum: number): string {
  return CHAPTER_CATALOGUE.find((c) => c.id === chapterNum)?.title ?? `Chapter ${chapterNum}`;
}

// ── Grant card ────────────────────────────────────────────────────────────────

function GrantCard({ grant }: { grant: PlayerGrant }) {
  const label = resolveGrantSkillLabel(grant);
  const dot   = RARITY_DOT[grant.rarity] ?? RARITY_DOT.common;

  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-white/8
                    bg-amber-900/10 hover:bg-amber-900/20 transition-colors duration-150">
      {/* top row */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="flex items-center gap-1 text-[10px] text-amber-500/70 uppercase tracking-wider font-bold">
          {CATEGORY_ICON[grant.grantCategory]}
          {CATEGORY_LABEL[grant.grantCategory] ?? grant.grantCategory}
        </span>
      </div>
      {/* name */}
      <p className="text-sm font-semibold text-amber-200 leading-tight">{label}</p>
      {/* flavour */}
      {grant.flavourText && (
        <p className="text-xs text-stone-400 italic leading-snug line-clamp-2">{grant.flavourText}</p>
      )}
      {/* chapter footer */}
      <p className="text-[10px] text-stone-600 mt-1">
        Ch {grant.awardedAtChapter} · {chapterTitle(grant.awardedAtChapter)}
      </p>
    </div>
  );
}

// ── Chapter section ───────────────────────────────────────────────────────────

function ChapterSection({ chapterNum, grants }: { chapterNum: number; grants: PlayerGrant[] }) {
  const [open, setOpen] = useState(true);
  const title = chapterTitle(chapterNum);

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      {/* header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3
                   bg-white/4 hover:bg-white/7 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Sparkles size={13} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">
            Chapter {chapterNum}
            <span className="text-stone-400 font-normal ml-2">— {title}</span>
          </span>
          <span className="ml-2 text-[10px] bg-amber-900/30 border border-amber-700/40
                           text-amber-400 px-1.5 py-0.5 rounded font-bold">
            {grants.length}
          </span>
        </span>
        {open
          ? <ChevronDown  size={14} className="text-stone-500" />
          : <ChevronRight size={14} className="text-stone-500" />}
      </button>

      {/* grid */}
      {open && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {grants.map((g) => <GrantCard key={g.id} grant={g} />)}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function GrantsChronicleTab() {
  const [, navigate] = useLocation();
  const { allGrants, isLoading } = usePlayerGrants();

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading grants…</p>
      </div>
    );
  }

  if (allGrants.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
        <Sparkles size={32} className="text-amber-700/50" />
        <p className="text-stone-400 text-sm max-w-xs">
          No story grants yet. Complete chapters to earn companions, equipment,
          spirit beasts, and war horses.
        </p>
        <button
          onClick={() => navigate("/story/1")}
          className="px-4 py-2 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-700/40
                     text-amber-300 text-xs rounded transition"
        >
          Begin Chapter 1
        </button>
      </div>
    );
  }

  // Group by chapter number, sorted ascending
  const byChapter = new Map<number, PlayerGrant[]>();
  for (const g of allGrants) {
    const ch = g.awardedAtChapter ?? 0;
    const arr = byChapter.get(ch) ?? [];
    arr.push(g);
    byChapter.set(ch, arr);
  }
  const chapters = [...byChapter.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-stone-500 uppercase tracking-wider font-bold">
          {allGrants.length} active grant{allGrants.length !== 1 ? "s" : ""} across {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
        </p>
      </div>
      {chapters.map((ch) => (
        <ChapterSection key={ch} chapterNum={ch} grants={byChapter.get(ch)!} />
      ))}
    </div>
  );
}
