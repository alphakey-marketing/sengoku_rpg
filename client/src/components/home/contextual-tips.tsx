import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sword, Shield, Trophy, Zap, BookOpen, Star, ChevronRight, Sparkles } from "lucide-react";
import type { PlayerData, Companion, Equipment } from "@/hooks/use-game";
import type { PlayerFlag } from "@/hooks/use-story";

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
}

interface Props {
  player: PlayerData;
  companions: Companion[];
  equipment: Equipment[];
  flags: PlayerFlag[];
}

function getFlagValue(flags: PlayerFlag[], key: string): number {
  // Guard: flags may be undefined/null or a non-array (e.g. a 401 error object)
  // before the query resolves. Fall back to 0 safely.
  if (!Array.isArray(flags)) return 0;
  return flags.find(f => f.flagKey === key)?.flagValue ?? 0;
}

export function ContextualTips({ player, companions, equipment, flags }: Props) {
  const tips: TipCard[] = [];

  // Normalise props that may not be arrays yet while queries are loading
  const safeFlags      = Array.isArray(flags)      ? flags      : [];
  const safeCompanions = Array.isArray(companions) ? companions : [];
  const safeEquipment  = Array.isArray(equipment)  ? equipment  : [];

  const partyMembers = safeCompanions.filter(c => c.isInParty);
  const equippedItems = safeEquipment.filter(e => e.isEquipped && e.equippedToType === "player");
  const hasWeapon = equippedItems.some(e => e.type === "Weapon");
  const statPointsAvailable = player.statPoints > 0;
  const totalCompanions = safeCompanions.length;
  const loyaltyHanzo    = getFlagValue(safeFlags, "loyalty_hanzo");
  const loyaltyYukimura = getFlagValue(safeFlags, "loyalty_yukimura");
  const campaignProgress = getFlagValue(safeFlags, "campaign_chapter");

  // Priority 1 — No companions at all
  if (totalCompanions === 0) {
    tips.push({
      id: "no-companions",
      icon: Users,
      color: "text-amber-400",
      borderColor: "border-amber-700/40",
      title: "Recruit Your First Ally",
      body: "A lord fights best with loyal warriors at their side. Visit the War Council Shrine to summon your first companion.",
      cta: "Visit War Council",
      href: "/war-council",
      priority: 1,
    });
  }

  // Priority 2 — Has companions but none in party
  if (totalCompanions > 0 && partyMembers.length === 0) {
    tips.push({
      id: "no-party",
      icon: Users,
      color: "text-blue-400",
      borderColor: "border-blue-700/40",
      title: "Form Your War Party",
      body: `You have ${totalCompanions} warrior${totalCompanions > 1 ? "s" : ""} but none are assigned to your party. Add companions to fight alongside you in battle.`,
      cta: "Manage Party",
      href: "/war-council",
      priority: 2,
    });
  }

  // Priority 3 — No weapon equipped
  if (!hasWeapon && safeEquipment.length > 0) {
    tips.push({
      id: "no-weapon",
      icon: Sword,
      color: "text-orange-400",
      borderColor: "border-orange-700/40",
      title: "Equip a Weapon",
      body: "Your attack power is reduced without a weapon. Head to the Armory to equip one of your items.",
      cta: "Open Armory",
      href: "/armory",
      priority: 3,
    });
  }

  // Priority 4 — Stat points waiting
  if (statPointsAvailable) {
    tips.push({
      id: "stat-points",
      icon: Trophy,
      color: "text-purple-400",
      borderColor: "border-purple-700/40",
      title: `${player.statPoints} Stat Point${player.statPoints > 1 ? "s" : ""} Available`,
      body: "Unspent attribute points are wasted potential. Allocate them below to grow stronger.",
      cta: "Allocate Now",
      href: "/",
      priority: 4,
    });
  }

  // Priority 5 — Loyalty flags: Hanzo or Yukimura near unlock
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
    });
  }

  // Priority 6 — Chapter progress nudge
  if (campaignProgress === 0 && player.level >= 1) {
    tips.push({
      id: "start-story",
      icon: BookOpen,
      color: "text-accent",
      borderColor: "border-accent/40",
      title: "Begin Your Chronicle",
      body: "Your story is unwritten. The Visual Novel campaign will unlock powerful companions and reveal the mysteries of the Sengoku era.",
      cta: "Open Story",
      href: "/story",
      priority: 6,
    });
  }

  // Priority 7 — Low gold nudge
  if (player.gold < 50 && player.level >= 3) {
    tips.push({
      id: "low-gold",
      icon: Zap,
      color: "text-yellow-400",
      borderColor: "border-yellow-700/40",
      title: "Treasury Running Low",
      body: "You need gold to summon allies and upgrade gear. Head to the Campaign Map and fight some field skirmishes.",
      cta: "Go to Map",
      href: "/map",
      priority: 7,
    });
  }

  const sorted = tips.sort((a, b) => a.priority - b.priority).slice(0, 3);
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
