/**
 * NewGrantRing.tsx  (Sprint 2 — 3a)
 *
 * Wraps an inventory card and renders a pulsing amber ring when the
 * wrapped item was recently granted (within 24 h, not yet seen).
 *
 * Usage
 * ─────
 *   import { NewGrantRing } from "@/components/story/NewGrantRing";
 *
 *   const markSeen  = useMarkGrantSeen();
 *   const newGrants = useNewGrants();
 *   const isNew     = newGrants.companion.some(g => g.gameRowId === comp.id);
 *
 *   <NewGrantRing isNew={isNew} gameRowId={comp.id}>
 *     <CompanionCard companion={comp} />
 *   </NewGrantRing>
 *
 * Props
 * ─────
 *   isNew          — controls ring visibility; when false children are
 *                    rendered with zero wrapper overhead
 *   gameRowId      — passed to useMarkGrantSeen() on first pointerdown
 *   ringClassName  — extra Tailwind classes forwarded to the ring div;
 *                    pass rounded-lg / rounded-xl to match card radius
 *   children       — the card element to wrap
 *
 * Dismissal
 * ─────────
 * The ring is cleared on pointerdown (fires before click) so it
 * disappears the instant the player taps — before any modal or
 * detail panel opens.  The event bubbles normally so the wrapped
 * card's own onClick / onPointerDown handlers still fire.
 */

import { useRef } from "react";
import { useMarkGrantSeen } from "@/hooks/use-grants";

interface NewGrantRingProps {
  isNew?:        boolean;
  gameRowId:     number | null;
  ringClassName?: string;
  children:      React.ReactNode;
}

export function NewGrantRing({
  isNew,
  gameRowId,
  ringClassName = "",
  children,
}: NewGrantRingProps) {
  const markSeen  = useMarkGrantSeen();
  const dismissed = useRef(false);

  // Fast path — zero overhead when not new
  if (!isNew) return <>{children}</>;

  function handlePointerDown() {
    if (dismissed.current)          return;
    if (gameRowId === null)         return;
    dismissed.current = true;
    markSeen(gameRowId);
  }

  return (
    <div
      className="relative"
      onPointerDown={handlePointerDown}
    >
      {/* Outer pulsing ring — pure CSS, no Framer dep */}
      <div
        aria-hidden="true"
        className={`
          pointer-events-none absolute inset-0 z-10
          grant-ring-pulse rounded
          ${ringClassName}
        `}
      />
      {/* Inner solid border */}
      <div
        aria-hidden="true"
        className={`
          pointer-events-none absolute inset-0 z-10
          border-2 border-amber-400/80 rounded
          ${ringClassName}
        `}
      />
      {children}
    </div>
  );
}
