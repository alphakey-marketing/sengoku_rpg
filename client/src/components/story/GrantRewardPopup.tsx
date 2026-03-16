/**
 * GrantRewardPopup.tsx  (Part 9/10)
 *
 * Fullscreen chapter-end grant reveal screen.
 *
 * Shown automatically by StoryPlayer when POST /api/story/progress/complete
 * returns a non-empty `grants` array.  The popup sequences through each grant
 * one at a time with a cinematic staggered entrance, then calls onDismiss()
 * when the player taps through or clicks "Continue".
 *
 * Props
 * ─────
 *  grants     IssuedGrant[]  — from the /progress/complete response
 *  onDismiss  () => void     — called after the player dismisses all cards
 *
 * Render contract
 * ───────────────
 *  • If grants is empty the component renders nothing (null).
 *  • Each grant is shown as a full-bleed card; the player taps to advance.
 *  • After the last card a summary slide lists all grants together.
 *  • The summary slide has a single "Continue" button that calls onDismiss.
 *
 * Category icons
 * ──────────────
 *  companion → 将  (kanji: general)
 *  equipment → 刀  (kanji: blade)
 *  pet       → 獣  (kanji: beast)
 *  horse     → 馬  (kanji: horse)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSkillName } from "@shared/skill-descriptions";

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirror of the IssuedGrant shape returned by evaluateGrants / the route.

export interface IssuedGrant {
  grantKey:      string;
  displayName:   string;
  flavourText:   string | null;
  grantCategory: string;
  rarity:        string;
  gameRowId:     number | null;
}

interface GrantRewardPopupProps {
  grants:    IssuedGrant[];
  onDismiss: () => void;
}

// ── Rarity palette ────────────────────────────────────────────────────────────

const RARITY_STYLES: Record<string, {
  border: string;
  glow:   string;
  badge:  string;
  text:   string;
}> = {
  uncommon:  { border: "border-emerald-500/60",   glow: "shadow-[0_0_40px_rgba(16,185,129,0.3)]",   badge: "bg-emerald-900/60 text-emerald-300",  text: "text-emerald-300" },
  rare:      { border: "border-blue-400/60",       glow: "shadow-[0_0_40px_rgba(96,165,250,0.3)]",   badge: "bg-blue-900/60 text-blue-300",        text: "text-blue-300"   },
  epic:      { border: "border-purple-400/60",     glow: "shadow-[0_0_50px_rgba(168,85,247,0.35)]",  badge: "bg-purple-900/60 text-purple-300",    text: "text-purple-300" },
  legendary: { border: "border-amber-400/70",      glow: "shadow-[0_0_60px_rgba(251,191,36,0.4)]",   badge: "bg-amber-900/60 text-amber-300",      text: "text-amber-300"  },
  // fallback
  common:    { border: "border-stone-500/50",      glow: "",                                          badge: "bg-stone-800 text-stone-300",          text: "text-stone-300"  },
};

function rarityStyle(rarity: string) {
  return RARITY_STYLES[rarity] ?? RARITY_STYLES.common;
}

// ── Category helpers ──────────────────────────────────────────────────────────

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

// ── Single grant card ─────────────────────────────────────────────────────────

interface GrantCardProps {
  grant:     IssuedGrant;
  index:     number;
  total:     number;
  onAdvance: () => void;
}

function GrantCard({ grant, index, total, onAdvance }: GrantCardProps) {
  const s       = rarityStyle(grant.rarity);
  const kanji   = CATEGORY_KANJI[grant.grantCategory] ?? "紋";
  const catLabel = CATEGORY_LABEL[grant.grantCategory] ?? grant.grantCategory;
  const skillName = getSkillName(grant.grantKey);

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

      {/* Category kanji crest */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
        className={`w-24 h-24 rounded-full border-2 ${s.border} ${s.glow}
                    flex items-center justify-center mb-8`}
      >
        <span className="font-display text-5xl" style={{ color: "inherit" }}>
          {kanji}
        </span>
      </motion.div>

      {/* Rarity + category badge */}
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
          className="max-w-sm text-center text-stone-400 text-sm italic leading-relaxed"
        >
          &ldquo;{grant.flavourText}&rdquo;
        </motion.p>
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

// ── Summary slide ─────────────────────────────────────────────────────────────

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
          const s = rarityStyle(g.rarity);
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

// ── Main component ────────────────────────────────────────────────────────────

export function GrantRewardPopup({ grants, onDismiss }: GrantRewardPopupProps) {
  // -1 = not yet started (shouldn't happen if caller guards on grants.length)
  // 0..n-1 = showing individual cards
  // n = showing summary
  const [step, setStep] = useState<number>(0);

  if (!grants || grants.length === 0) return null;

  const total = grants.length;

  function advance() {
    setStep((prev) => prev + 1);
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
