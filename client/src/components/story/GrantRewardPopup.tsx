/**
 * GrantRewardPopup.tsx  (Sprint 1 — 2b + 2c)
 *
 * Fullscreen chapter-end grant reveal screen.
 *
 * Sprint 1 additions on top of the existing sequential card flow (2a):
 *
 * 2b — Animated asset reveal per category:
 *   companion → Portrait tile fades in (opacity + scale, 600 ms)
 *   equipment → Kanji crest with a shimmer sweep keyframe (700 ms)
 *   pet       → Paw SVG silhouette materialises (opacity + scale, 800 ms)
 *   horse     → Horse kanji silhouette materialises (opacity + scale, 800 ms)
 *
 * 2c — Contextual deep-link CTA at the bottom of each reveal card:
 *   companion → /party   "View in War Council →"
 *   equipment → /gear    "View in Armoury →"
 *   pet       → /pets    "View in Menagerie →"
 *   horse     → /stable  "View in Stables →"
 *
 * onDismiss() is called before navigation so the chapter-complete screen
 * resolves cleanly before the panel transition fires.
 *
 * Fix (2026-03-18) — Issue 5:
 *   - IssuedGrant now carries `didUpgrade?: boolean` matching the server-side
 *     type in grant-evaluator.ts. The field was present on the wire but absent
 *     from the client interface so it was silently ignored.
 *   - GrantCard renders an amber upgrade banner when didUpgrade === true:
 *     ↥ Upgrade  ·  "replaces your previous <category>"
 *     Banner is suppressed (no DOM node) when didUpgrade is false or undefined,
 *     keeping first-acquisition cards pixel-identical to before.
 *   - PlayerGrantView from GET /api/story/grants has no didUpgrade; treating the
 *     field as optional (boolean | undefined) means the recovery path in
 *     StoryPlayer.tsx (Bug 4 fix) correctly omits the banner without code changes.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { getSkillName } from "@shared/skill-descriptions";
import { PORTRAIT_COLOURS, PORTRAIT_INITIALS } from "@/lib/story-constants";

// ── Types ──────────────────────────────────────────────────────────────────────────────

export interface IssuedGrant {
  grantKey:      string;
  displayName:   string;
  flavourText:   string | null;
  grantCategory: string;
  rarity:        string;
  gameRowId:     number | null;
  /**
   * True when this grant superseded a previously issued base grant
   * (e.g. Reforged Blade replacing Singing Blade).
   *
   * Optional so callers using the GET /api/story/grants recovery path
   * (PlayerGrantView, which has no didUpgrade field) don’t break —
   * the upgrade banner is simply suppressed when this is undefined.
   */
  didUpgrade?: boolean;
}

interface GrantRewardPopupProps {
  grants:    IssuedGrant[];
  onDismiss: () => void;
}

// ── Rarity palette ─────────────────────────────────────────────────────────────────────

const RARITY_STYLES: Record<string, {
  border: string;
  glow:   string;
  badge:  string;
  text:   string;
  shimmerFrom: string;
  silhouette:  string;
}> = {
  uncommon:  {
    border:      "border-emerald-500/60",
    glow:        "shadow-[0_0_40px_rgba(16,185,129,0.3)]",
    badge:       "bg-emerald-900/60 text-emerald-300",
    text:        "text-emerald-300",
    shimmerFrom: "rgba(16,185,129,0.55)",
    silhouette:  "text-emerald-400/70",
  },
  rare: {
    border:      "border-blue-400/60",
    glow:        "shadow-[0_0_40px_rgba(96,165,250,0.3)]",
    badge:       "bg-blue-900/60 text-blue-300",
    text:        "text-blue-300",
    shimmerFrom: "rgba(96,165,250,0.55)",
    silhouette:  "text-blue-400/70",
  },
  epic: {
    border:      "border-purple-400/60",
    glow:        "shadow-[0_0_50px_rgba(168,85,247,0.35)]",
    badge:       "bg-purple-900/60 text-purple-300",
    text:        "text-purple-300",
    shimmerFrom: "rgba(168,85,247,0.55)",
    silhouette:  "text-purple-400/70",
  },
  legendary: {
    border:      "border-amber-400/70",
    glow:        "shadow-[0_0_60px_rgba(251,191,36,0.4)]",
    badge:       "bg-amber-900/60 text-amber-300",
    text:        "text-amber-300",
    shimmerFrom: "rgba(251,191,36,0.55)",
    silhouette:  "text-amber-400/70",
  },
  common: {
    border:      "border-stone-500/50",
    glow:        "",
    badge:       "bg-stone-800 text-stone-300",
    text:        "text-stone-300",
    shimmerFrom: "rgba(168,162,158,0.4)",
    silhouette:  "text-stone-400/60",
  },
};

function rarityStyle(rarity: string) {
  return RARITY_STYLES[rarity] ?? RARITY_STYLES.common;
}

// ── Category helpers ────────────────────────────────────────────────────────────────

const CATEGORY_KANJI: Record<string, string> = {
  companion: "将",
  equipment: "刀",
  pet:       "獣",
  horse:     "馬",
};

const CATEGORY_LABEL: Record<string, string> = {
  companion: "Companion",
  equipment: "Equipment",
  pet:       "Pet",
  horse:     "Horse",
};

const CATEGORY_ROUTE: Record<string, string> = {
  companion: "/party",
  equipment: "/gear",
  pet:       "/pets",
  horse:     "/stable",
};

const CATEGORY_CTA: Record<string, string> = {
  companion: "View in War Council →",
  equipment: "View in Armoury →",
  pet:       "View in Menagerie →",
  horse:     "View in Stables →",
};

// ── 2b: Portrait key derivation ────────────────────────────────────────────────────
//
// IssuedGrant carries displayName (e.g. "Nohime") but not a portraitKey.
// We derive "<firstname_lower>_neutral" as the best-guess key, then fall back
// to a fixed rose/indigo colour if the key is absent from PORTRAIT_COLOURS.

function derivePortraitKey(displayName: string): string {
  const first = displayName.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  return `${first}_neutral`;
}

const COMPANION_FALLBACK_COLOURS = "bg-rose-900 border-rose-600";

// ── 2b: Animated asset reveal components ────────────────────────────────────────────

/** Shimmer keyframe — injected once; Tailwind purge-safe via a <style> tag. */
const SHIMMER_STYLE = `
@keyframes shimmerSweep {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.grant-shimmer {
  background-size: 200% auto;
  animation: shimmerSweep 1.4s linear infinite;
}
`;

interface AssetRevealProps {
  grant: IssuedGrant;
}

function CompanionReveal({ grant }: AssetRevealProps) {
  const portraitKey = derivePortraitKey(grant.displayName);
  const colours     = PORTRAIT_COLOURS[portraitKey] ?? COMPANION_FALLBACK_COLOURS;
  const initials    = PORTRAIT_INITIALS[portraitKey] ?? grant.displayName[0]?.toUpperCase() ?? "?";
  const s           = rarityStyle(grant.rarity);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
      className={`w-28 h-36 rounded-sm border-2 ${colours} ${s.glow}
                  flex items-end justify-center pb-2 mb-6 shadow-2xl`}
    >
      <span className="text-3xl font-bold text-white/60">{initials}</span>
    </motion.div>
  );
}

function EquipmentReveal({ grant }: AssetRevealProps) {
  const s     = rarityStyle(grant.rarity);
  const kanji = CATEGORY_KANJI.equipment;

  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.55, ease: "easeOut" }}
        className={`w-24 h-24 rounded-full border-2 ${s.border} ${s.glow}
                    flex items-center justify-center mb-6 relative overflow-hidden`}
        style={{
          background: `linear-gradient(120deg, transparent 25%, ${s.shimmerFrom} 50%, transparent 75%)`,
        }}
      >
        <div
          className="grant-shimmer absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(120deg, transparent 20%, ${s.shimmerFrom} 50%, transparent 80%)`,
          }}
        />
        <span className={`font-display text-5xl relative z-10 ${s.text}`}>{kanji}</span>
      </motion.div>
    </>
  );
}

function PetReveal({ grant }: AssetRevealProps) {
  const s = rarityStyle(grant.rarity);
  return (
    <motion.div
      initial={{ opacity: 0.15, scale: 0.72 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.08, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      className={`mb-6 ${s.silhouette}`}
    >
      {/* Paw print SVG silhouette */}
      <svg viewBox="0 0 64 64" className="w-24 h-24 fill-current drop-shadow-lg">
        <ellipse cx="32" cy="48" rx="14" ry="11" />
        <ellipse cx="14" cy="30" rx="7"  ry="9"  />
        <ellipse cx="50" cy="30" rx="7"  ry="9"  />
        <ellipse cx="22" cy="18" rx="6"  ry="8"  />
        <ellipse cx="42" cy="18" rx="6"  ry="8"  />
      </svg>
    </motion.div>
  );
}

function HorseReveal({ grant }: AssetRevealProps) {
  const s     = rarityStyle(grant.rarity);
  const kanji = CATEGORY_KANJI.horse;
  return (
    <motion.div
      initial={{ opacity: 0.15, scale: 0.72 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.08, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      className={`w-28 h-28 flex items-center justify-center mb-6 ${s.silhouette}`}
    >
      <span className="font-display text-8xl leading-none">{kanji}</span>
    </motion.div>
  );
}

function AssetReveal({ grant }: AssetRevealProps) {
  switch (grant.grantCategory) {
    case "companion": return <CompanionReveal grant={grant} />;
    case "equipment": return <EquipmentReveal grant={grant} />;
    case "pet":       return <PetReveal       grant={grant} />;
    case "horse":     return <HorseReveal     grant={grant} />;
    default:          return null;
  }
}

// ── Issue 5: Upgrade banner ──────────────────────────────────────────────────────────────────
//
// Shown above the rarity/category badges when grant.didUpgrade === true.
// Suppressed entirely (returns null) when didUpgrade is false or undefined
// so standard first-acquisition cards are pixel-identical to before.

interface UpgradeBannerProps {
  grantCategory: string;
}

function UpgradeBanner({ grantCategory }: UpgradeBannerProps) {
  const catLabel = (CATEGORY_LABEL[grantCategory] ?? grantCategory).toLowerCase();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.4 }}
      className="flex flex-col items-center gap-0.5 mb-3"
    >
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                        bg-amber-900/60 border border-amber-600/40 text-amber-400
                        text-xs font-semibold tracking-widest uppercase">
        <span aria-hidden="true">↥</span> Upgrade
      </span>
      <span className="text-stone-400 text-xs">
        replaces your previous {catLabel}
      </span>
    </motion.div>
  );
}

// ── Single grant card ──────────────────────────────────────────────────────────────────────

interface GrantCardProps {
  grant:     IssuedGrant;
  index:     number;
  total:     number;
  onAdvance: () => void;
  onDeepLink: (route: string) => void;
}

function GrantCard({ grant, index, total, onAdvance, onDeepLink }: GrantCardProps) {
  const s        = rarityStyle(grant.rarity);
  const catLabel = CATEGORY_LABEL[grant.grantCategory] ?? grant.grantCategory;
  const skillName = getSkillName(grant.grantKey);
  const ctaLabel  = CATEGORY_CTA[grant.grantCategory];
  const ctaRoute  = CATEGORY_ROUTE[grant.grantCategory];

  return (
    <motion.div
      key={grant.grantKey}
      initial={{ opacity: 0, scale: 0.88, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.04, y: -30 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      onClick={onAdvance}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 bg-gradient-to-b from-zinc-950 via-black to-zinc-950
                 cursor-pointer select-none px-6"
    >
      {/* Progress indicator */}
      <div className="absolute top-6 right-6 text-stone-600 text-xs tracking-widest">
        {index + 1} / {total}
      </div>

      {/* 2b — Animated asset reveal */}
      <AssetReveal grant={grant} />

      {/* Issue 5 — Upgrade banner (only when didUpgrade === true) */}
      {grant.didUpgrade === true && (
        <UpgradeBanner grantCategory={grant.grantCategory} />
      )}

      {/* Rarity + category badges */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }}
        className="flex gap-2 mb-4"
      >
        <span className={`text-xs px-2 py-0.5 rounded uppercase tracking-widest font-semibold ${s.badge}`}>
          {grant.rarity}
        </span>
        <span className="text-xs px-2 py-0.5 rounded uppercase tracking-widest
                         bg-white/5 text-stone-400">
          {catLabel}
        </span>
      </motion.div>

      {/* Grant name */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.45 }}
        className={`text-3xl font-bold font-display text-center mb-2 ${s.text}`}
      >
        {grant.displayName}
      </motion.h2>

      {/* Skill name */}
      {skillName && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.50, duration: 0.4 }}
          className="text-amber-400 text-xs tracking-widest uppercase mb-5"
        >
          Skill: {skillName}
        </motion.p>
      )}

      {/* Flavour text */}
      {grant.flavourText && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.4 }}
          className="max-w-sm text-center text-stone-400 text-sm italic leading-relaxed mb-8"
        >
          &ldquo;{grant.flavourText}&rdquo;
        </motion.p>
      )}

      {/* 2c — Deep-link CTA */}
      {ctaLabel && ctaRoute && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78, duration: 0.35 }}
          onClick={(e) => {
            e.stopPropagation(); // don't also fire onAdvance
            onDeepLink(ctaRoute);
          }}
          className={`px-5 py-2 rounded border ${s.border} ${s.text}
                       bg-white/5 hover:bg-white/10 text-xs font-semibold
                       tracking-widest uppercase transition-colors`}
        >
          {ctaLabel}
        </motion.button>
      )}

      {/* Tap hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ delay: 1.1, duration: 1.5, repeat: Infinity }}
        className="absolute bottom-10 text-xs text-stone-600 tracking-widest uppercase"
      >
        {index < total - 1 ? "Tap for next reward ▸" : "Tap to continue ▸"}
      </motion.p>
    </motion.div>
  );
}

// ── Summary slide ───────────────────────────────────────────────────────────────────────

interface SummarySlideProps {
  grants:    IssuedGrant[];
  onDismiss: () => void;
}

function SummarySlide({ grants, onDismiss }: SummarySlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 px-6"
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-amber-400 text-xs tracking-widest uppercase mb-2"
      >
        Rewards Earned
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
        className="text-2xl font-bold font-display text-white mb-8"
      >
        Chapter Complete
      </motion.h2>

      <div className="w-full max-w-sm flex flex-col gap-3 mb-8">
        {grants.map((g, i) => {
          const s     = rarityStyle(g.rarity);
          const kanji = CATEGORY_KANJI[g.grantCategory] ?? "紋";
          return (
            <motion.div
              key={g.grantKey}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.09, duration: 0.35 }}
              className={`flex items-center gap-3 px-4 py-3 rounded
                           bg-white/5 border ${s.border}`}
            >
              <span className={`text-2xl font-display ${s.text}`}>{kanji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${s.text}`}>
                  {g.displayName}
                </p>
                <p className="text-xs text-stone-500 uppercase tracking-widest">
                  {CATEGORY_LABEL[g.grantCategory] ?? g.grantCategory}
                  {" · "}
                  {g.rarity}
                  {g.didUpgrade === true && (
                    <span className="ml-1.5 text-amber-500">↥ upgraded</span>
                  )}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + grants.length * 0.09, duration: 0.35 }}
        onClick={onDismiss}
        className="px-8 py-2.5 bg-amber-700 hover:bg-amber-600 text-white
                   rounded text-sm font-semibold transition-colors"
      >
        Continue →
      </motion.button>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────────────────

export function GrantRewardPopup({ grants, onDismiss }: GrantRewardPopupProps) {
  const [step, setStep]       = useState<number>(0);
  const [, navigate]          = useLocation();

  if (!grants || grants.length === 0) return null;

  const total = grants.length;

  function advance() {
    setStep((prev) => prev + 1);
  }

  /** 2c — dismiss the popup then navigate to the target panel. */
  function handleDeepLink(route: string) {
    onDismiss();
    navigate(route);
  }

  return (
    <AnimatePresence mode="wait">
      {step < total ? (
        <GrantCard
          key={`card-${step}`}
          grant={grants[step]}
          index={step}
          total={total}
          onAdvance={advance}
          onDeepLink={handleDeepLink}
        />
      ) : (
        <SummarySlide
          key="summary"
          grants={grants}
          onDismiss={onDismiss}
        />
      )}
    </AnimatePresence>
  );
}
