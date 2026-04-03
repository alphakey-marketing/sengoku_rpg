/**
 * GrantCinematicBeat.tsx  (Sprint 3 — 1b)
 *
 * Full-screen pre-reveal beat shown for 1.8 s before triggerCompletion()
 * hands off to GrantRewardPopup.  Player can tap/click to skip early.
 *
 * Sequence
 * ────────
 *   t =   50ms  fade overlay in (transition-opacity 500ms)
 *   t =  600ms  category icon pulses (grant-ring-pulse from index.css)
 *   t = 1800ms  onComplete() fires
 *
 * Props
 * ─────
 *   firstGrantCategory  — "companion"|"equipment"|"pet"|"horse"|undefined
 *   onComplete          — called when beat ends or is skipped
 */

import { useEffect, useRef, useState } from "react";

const CATEGORY_ICON: Record<string, string> = {
  companion: "👤",
  equipment: "⚔️",
  pet:       "🐾",
  horse:     "🐴",
};

const BEAT_MS = 1800;

interface GrantCinematicBeatProps {
  firstGrantCategory?: string;
  onComplete: () => void;
}

export function GrantCinematicBeat({ firstGrantCategory, onComplete }: GrantCinematicBeatProps) {
  const [visible,  setVisible]  = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const icon = (firstGrantCategory && CATEGORY_ICON[firstGrantCategory])
    ? CATEGORY_ICON[firstGrantCategory]
    : "★";

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true),  50);
    const t2 = setTimeout(() => setShowIcon(true), 600);
    const t3 = setTimeout(() => onCompleteRef.current(), BEAT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      role="presentation"
      aria-label="Chapter complete — cinematic beat"
      onClick={() => onCompleteRef.current()}
      className={`
        fixed inset-0 z-50
        flex flex-col items-center justify-center
        bg-black/95
        transition-opacity duration-500
        cursor-pointer select-none
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <div
        className={`
          text-7xl
          transition-all duration-300
          ${showIcon ? "opacity-100 scale-100 grant-ring-pulse" : "opacity-0 scale-75"}
        `}
      >
        {icon}
      </div>
      <p
        className={`
          mt-8 text-xs text-stone-600 tracking-widest uppercase
          transition-opacity duration-300
          ${showIcon ? "opacity-100" : "opacity-0"}
        `}
      >
        tap to skip
      </p>
    </div>
  );
}
