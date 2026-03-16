import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sword, Shield, Trophy, Zap, BookOpen, Star, ChevronRight, Sparkles, Scroll } from "lucide-react";
import type { PlayerData, Companion, Equipment } from "@/hooks/use-game";

// flags from useStoryFlags() is Record<string,number>
type FlagsRecord = Record<string, number>;

interface TipCard {
  id: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  priority: number;
  /** Minimum player.currentChapter required for the destination route.
   *  If the player hasn't reached this chapter the tip is suppressed. */
  requiredChapter: number;
}

interface Props {
  player: PlayerData & { currentChapter?: number };
  companions: Companion[];
  equipment: Equipment[];
  // Accept both the object shape (current) and legacy array shape
  flags: FlagsRecord | { flagKey: string; flagValue: number }[] | null | undefined;
}

function getFlagValue(flags: Props["flags"], key: string): number {
  if (!flags) return 0;
  if (!Array.isArray(flags)) return (flags as FlagsRecord)[key] ?? 0;
  return (flags as { flagKey: string; flagValue: number }[]).find(f => f.flagKey === key)?.flagValue ?? 0;
}

/**
 * Chapter gate map — mirrors client/src/lib/nav-unlock.ts exactly.
 * A tip pointing to a route is only shown when currentChapter >= value here.
 */
const ROUTE_CHAPTER: Record<string, number> = {
  "/story":     0,
  "/":          1,
  "/quests":    1,
  "/stable":    2,   // War Council — companion management
  "/gear":      3,
  "/equipment": 3,
  "/gacha":     4,
  "/pets":      5,
  "/party":     6,   // Stables / Horses (NOT companion party)
  "/map":       7,
};

export function ContextualTips({ player, companions, equipment, flags }: Props) {
  const currentChapter = player.currentChapter ?? 1;
  const tips: TipCard[] = [];

  const safeCompanions = Array.isArray(companions) ? companions : [];
  const safeEquipment  = Array.isArray(equipment)  ? equipment  : [];

  const partyMembers  = safeCompanions.filter(c => c.isInParty);
  const equippedItems = safeEquipment.filter(e => e.isEquipped && e.equippedToType === "player");
  const hasWeapon     = equippedItems.some(e => e.type === "Weapon");
  const statPointsAvailable = (player.statPoints ?? 0) > 0;
  const totalCompanions = safeCompanions.length;

  const loyaltyHanzo    = getFlagValue(flags, "loyalty_hanzo");
  const loyaltyYukimura = getFlagValue(flags, "loyalty_yukimura");
  const campaignProgress = getFlagValue(flags, "campaign_chapter");

  // ── Priority 1 — Companions arrived but none managed yet (War Council, ch 2) ─
  // Companions are story-gated, not gacha-gated. /stable = War Council where
  // players review/assign them. Only show once the player is at ch 2+.
  if (totalCompanions === 0 && currentChapter >= ROUTE_CHAPTER["/stable"]) {
    tips.push({
      id: "no-companions",
      icon: Users,
      color: "text-amber-400",
      borderColor: "border-amber-700/40",
      title: "Visit the War Council",
      body: "Your companions are waiting at the War Council. Head there to review and manage your growing retinue.",
      cta: "Open War Council",
      href: "/stable",
      priority: 1,
      requiredChapter: ROUTE_CHAPTER["/stable"],
    });
  }

  // ── Priority 2 — Has companions but none assigned to party (War Council, ch 2) ─
  if (totalCompanions > 0 && partyMembers.length === 0 && currentChapter >= ROUTE_CHAPTER["/stable"]) {
    tips.push({
      id: "no-party",
      icon: Users,
      color: "text-blue-400",
      borderColor: "border-blue-700/40",
      title: "Form Your War Party",
      body: `You have ${totalCompanions} warrior${totalCompanions > 1 ? "s" : ""} but none are in your party. Assign them at the War Council.`,
      cta: "Manage at War Council",
      href: "/stable",
      priority: 2,
      requiredChapter: ROUTE_CHAPTER["/stable"],
    });
  }

  // ── Priority 3 — No weapon equipped (Equipment page, ch 3) ───────────────
  if (!hasWeapon && safeEquipment.length > 0 && currentChapter >= ROUTE_CHAPTER["/equipment"]) {
    tips.push({
      id: "no-weapon",
      icon: Sword,
      color: "text-orange-400",
      borderColor: "border-orange-700/40",
      title: "Equip a Weapon",
      body: "Your attack power is reduced without a weapon. Head to the Equipment page to equip one of your items.",
      cta: "Open Equipment",
      href: "/equipment",
      priority: 3,
      requiredChapter: ROUTE_CHAPTER["/equipment"],
    });
  }

  // ── Priority 4 — Unspent stat points (Dojo, always safe at ch 1+) ─────────
  if (statPointsAvailable && currentChapter >= ROUTE_CHAPTER["/"]) {
    tips.push({
      id: "stat-points",
      icon: Trophy,
      color: "text-purple-400",
      borderColor: "border-purple-700/40",
      title: `${player.statPoints} Stat Point${(player.statPoints ?? 0) > 1 ? "s" : ""} Available`,
      body: "Unspent attribute points are wasted potential. Allocate them in the Warlord's Identity panel on this page.",
      cta: "Allocate Now",
      href: "/",
      priority: 4,
      requiredChapter: ROUTE_CHAPTER["/"],
    });
  }

  // ── Priority 5 — Loyalty flags near unlock (always → /story) ─────────────
  if (loyaltyHanzo > 0 && loyaltyHanzo < 5) {
    tips.push({
      id: "loyalty-hanzo",
      icon: Star,
      color: "text-red-400",
      borderColor: "border-red-700/40",
      title: "Hanzo's Loyalty Growing",
      body: `Hattori Hanzo's loyalty is at ${loyaltyHanzo}/5. Continue your story to unlock this legendary shinobi.`,
      cta: "Continue Story",
      href: "/story",
      priority: 5,
      requiredChapter: 0,
    });
  }
  if (loyaltyYukimura > 0 && loyaltyYukimura < 5) {
    tips.push({
      id: "loyalty-yukimura",
      icon: Sparkles,
      color: "text-cyan-400",
      borderColor: "border-cyan-700/40",
      title: "Yukimura Stirs",
      body: `Sanada Yukimura's loyalty is at ${loyaltyYukimura}/5. One more act of bravery may sway him to your banner.`,
      cta: "Continue Story",
      href: "/story",
      priority: 5,
      requiredChapter: 0,
    });
  }

  // ── Priority 6 — No story progress yet (always → /story) ─────────────────
  if (campaignProgress === 0 && (player.level ?? 1) >= 1) {
    tips.push({
      id: "start-story",
      icon: BookOpen,
      color: "text-accent",
      borderColor: "border-accent/40",
      title: "Continue Your Chronicle",
      body: "Your story is still unfolding. The campaign will unlock powerful companions and reveal the mysteries of the Sengoku era.",
      cta: "Open Story",
      href: "/story",
      priority: 6,
      requiredChapter: 0,
    });
  }

  // ── Priority 7 — Daily Quests (ch 1+, always a safe fallback) ─────────────
  if (currentChapter >= ROUTE_CHAPTER["/quests"]) {
    tips.push({
      id: "daily-quests",
      icon: Scroll,
      color: "text-green-400",
      borderColor: "border-green-700/40",
      title: "Daily Quests Available",
      body: "Complete daily quests to earn rice, gold, and experience. Small tasks, big rewards.",
      cta: "View Quests",
      href: "/quests",
      priority: 7,
      requiredChapter: ROUTE_CHAPTER["/quests"],
    });
  }

  // ── Priority 8 — Low gold (Map, ch 7 only) ────────────────────────────────
  if ((player.gold ?? 0) < 50 && (player.level ?? 1) >= 3 && currentChapter >= ROUTE_CHAPTER["/map"]) {
    tips.push({
      id: "low-gold",
      icon: Zap,
      color: "text-yellow-400",
      borderColor: "border-yellow-700/40",
      title: "Treasury Running Low",
      body: "You need gold to upgrade gear. Head to the Campaign Map and fight some field skirmishes.",
      cta: "Go to Map",
      href: "/map",
      priority: 8,
      requiredChapter: ROUTE_CHAPTER["/map"],
    });
  }

  // Filter to only tips whose destination route is unlocked for this player,
  // sort by priority, cap at 3 cards shown at once.
  const sorted = tips
    .filter(t => currentChapter >= t.requiredChapter)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4 flex items-center gap-2">
        <Zap size={18} className="text-primary" />
        What To Do Next
      </h3>
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((tip, i) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link href={tip.href}>
                <div className={`group relative bg-card border ${tip.borderColor} rounded-xl p-4 cursor-pointer hover:scale-[1.02] transition-all duration-200 hover:shadow-lg h-full flex flex-col`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-background/60 border border-border/30 shrink-0 ${tip.color}`}>
                      <tip.icon size={16} />
                    </div>
                    <p className="text-sm font-bold text-white font-display leading-tight">{tip.title}</p>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed flex-1">{tip.body}</p>
                  <div className={`mt-3 flex items-center gap-1 text-xs font-bold ${tip.color}`}>
                    {tip.cta}
                    <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
