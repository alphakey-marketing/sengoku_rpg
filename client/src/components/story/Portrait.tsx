/**
 * Portrait.tsx
 * Renders a character portrait tile using colour and initials derived
 * from the portraitKey lookup tables in story-constants.
 */
import { PORTRAIT_COLOURS, PORTRAIT_INITIALS } from "@/lib/story-constants";

interface PortraitProps {
  portraitKey: string | null;
  side: "left" | "right";
}

export function Portrait({ portraitKey, side }: PortraitProps) {
  if (!portraitKey) return <div className="w-28 h-36 md:w-32 md:h-44" />;
  const colours  = PORTRAIT_COLOURS[portraitKey] ?? "bg-stone-700 border-stone-500";
  const initials = PORTRAIT_INITIALS[portraitKey] ?? "?";
  const flip     = side === "right" ? "scale-x-[-1]" : "";
  return (
    <div className={`w-28 h-36 md:w-32 md:h-44 rounded-sm border-2 ${colours} ${flip}
      flex items-end justify-center pb-1 shadow-lg flex-shrink-0 transition-all duration-300`}>
      <span className={`text-2xl font-bold text-white/60 ${flip}`}>{initials}</span>
    </div>
  );
}
