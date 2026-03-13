import { useState } from "react";
import { useCompanions, useSetParty, useEquipment, usePlayer, useRecycleCompanion, useUpgradeCompanion, Companion } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Users, Star, Sword, Shield, Zap, Heart, Trash2, Hammer, Flame, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

// ─── Phase B4: lore blurbs keyed by canonical companion name ──────────────────
// Source of truth is server/constants/specialCompanions.ts (unlockMessage).
// Duplicated here so the client needs no extra API round-trip.
const STORY_LORE: Record<string, string> = {
  "Akechi Mitsuhide":  "Mitsuhide pledges his unwavering loyalty. His careful mind joins your cause.",
  "Toyotomi Hideyoshi": "Hideyoshi grins and vows to repay your faith tenfold.",
  "Tokugawa Ieyasu":   "Ieyasu clasps your arm. \"I follow the strongest pillar.\"",
  "Nohime":            "Nohime emerges from the shadows, drawn by the cursed blade's resonance.",
  "Mori Ranmaru":      "Ranmaru steps forward, eyes burning. \"I serve only the Demon King.\"",
};

// ─── Rarity badge styles ──────────────────────────────────────────────────────
// Handles both numeric gacha rarity ("1"–"5") and string story rarity.
function rarityBadgeClass(rarity: string): string {
  // Numeric gacha
  if (rarity === "5") return "text-orange-500 border-orange-500 bg-orange-500/10 shadow-[0_0_10px_rgba(255,165,0,0.3)]";
  if (rarity === "4") return "text-purple-400 border-purple-400 bg-purple-400/10";
  if (rarity === "3") return "text-blue-400   border-blue-400   bg-blue-400/10";
  if (rarity === "2") return "text-green-500  border-green-500  bg-green-500/10";
  if (rarity === "1") return "text-zinc-400   border-zinc-700   bg-zinc-800/50";
  // String story rarity
  if (rarity === "legendary")    return "text-amber-400  border-amber-500  bg-amber-500/10  shadow-[0_0_12px_rgba(245,158,11,0.35)]";
  if (rarity === "epic")         return "text-purple-400 border-purple-500 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.3)]";
  if (rarity === "gold")         return "text-yellow-400 border-yellow-500 bg-yellow-500/10";
  if (rarity === "mythic")       return "text-pink-400   border-pink-500   bg-pink-500/10";
  if (rarity === "transcendent") return "text-white      border-white/40   bg-white/10";
  return "text-zinc-400 border-zinc-700 bg-zinc-800/50";
}

function rarityLabel(rarity: string): string {
  // Numeric → "N-Star"
  if (/^[1-5]$/.test(rarity)) return `${rarity}-Star`;
  // String → capitalise first letter
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// ─── Source filter type ───────────────────────────────────────────────────────
type SourceFilter = "All" | "Story" | "Gacha";

export default function Party() {
  const { data: player } = usePlayer();
  const { data: companions, isLoading } = useCompanions();
  const { data: equipment } = useEquipment();
  const { mutate: setParty, isPending } = useSetParty();
  const { mutate: recycleComp, isPending: recyclePending } = useRecycleCompanion();
  const { mutate: upgradeComp, isPending: upgradePending } = useUpgradeCompanion();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All");

  if (companions && selectedIds.length === 0 && companions.some(c => c.isInParty)) {
    setSelectedIds(companions.filter(c => c.isInParty).map(c => c.id));
  }

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(cId => cId !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleSave = () => {
    setParty(selectedIds, {
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Deployment Failed",
          description: err.message
        });
      }
    });
  };

  const getCompEquipped = (compId: number) =>
    equipment?.filter(e => e.isEquipped && e.equippedToType === "companion" && e.equippedToId === compId) || [];

  if (isLoading) return <MainLayout><div className="p-8">Loading companions...</div></MainLayout>;

  // Apply source filter
  const allSorted = companions ? [...companions].sort((a, b) => a.id - b.id) : [];
  const filteredComps = allSorted.filter(c => {
    if (sourceFilter === "Story") return c.isSpecial;
    if (sourceFilter === "Gacha") return !c.isSpecial;
    return true;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">War Council</h1>
            <p className="text-muted-foreground">Select up to 5 unique warriors for your active party.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-orange-900/20 border border-orange-700/30 px-4 py-2 rounded-lg">
              <Flame size={18} className="text-orange-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-orange-300 uppercase font-bold tracking-wider leading-none">Warrior Souls</span>
                <span className="text-lg font-bold text-white leading-none">{player?.warriorSouls || 0}</span>
              </div>
            </div>
            <span className="text-sm font-medium bg-secondary/30 px-3 py-1 rounded border border-secondary text-secondary-foreground">
              {selectedIds.length} / 5 Selected
            </span>
            <Button
              onClick={handleSave}
              disabled={isPending || selectedIds.length === 0}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              data-testid="button-deploy-party"
            >
              {isPending ? "Updating..." : "Deploy Party"}
            </Button>
          </div>
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-2">
          {(["All", "Story", "Gacha"] as SourceFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                sourceFilter === f
                  ? f === "Story"
                    ? "bg-amber-700/30 border-amber-500/60 text-amber-300"
                    : "bg-primary/20 border-primary/60 text-primary"
                  : "bg-transparent border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"
              }`}
            >
              {f === "Story" && <BookOpen size={11} />}
              {f === "Gacha" && <Star size={11} />}
              {f}
              {f !== "All" && companions && (
                <span className="opacity-60">
                  {companions.filter(c => f === "Story" ? c.isSpecial : !c.isSpecial).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Companion grid */}
        {filteredComps.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            {sourceFilter === "Story" ? (
              <>
                <h3 className="text-lg font-medium text-white mb-2">No Chronicle Companions Yet</h3>
                <p className="text-muted-foreground">Complete story chapters to recruit historical allies.</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-white mb-2">No Companions Yet</h3>
                <p className="text-muted-foreground">Visit the Shrine to summon allies to your cause.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredComps.map((comp, i) => {
              const isSelected  = selectedIds.includes(comp.id);
              const compEquip   = getCompEquipped(comp.id);
              const isStory     = comp.isSpecial;
              const lore        = isStory ? (STORY_LORE[comp.name] ?? null) : null;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={comp.id}
                  className={`
                    relative rounded-lg p-5 transition-all duration-300 border bg-washi flex flex-col
                    ${
                      isSelected
                        ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                        : isStory
                        ? "bg-amber-950/10 border-amber-700/30 hover:border-amber-500/50"
                        : "bg-card border-border/50 hover:border-accent/40"
                    }
                  `}
                  data-testid={`companion-card-${comp.id}`}
                >
                  {/* Story badge */}
                  {isStory && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full
                      bg-amber-900/40 border border-amber-500/50 text-amber-300 text-[10px] font-bold tracking-widest">
                      <BookOpen size={9} />
                      Chronicle
                    </div>
                  )}

                  <div className="flex gap-4 cursor-pointer" onClick={() => toggleSelection(comp.id)}>
                    <div className="w-16 h-16 rounded bg-background border border-border flex items-center justify-center shrink-0">
                      <Users className={isSelected ? "text-primary" : isStory ? "text-amber-500" : "text-muted-foreground"} size={32} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        {/* Leave room for the Story badge on the right */}
                        <h3 className={`font-bold font-display text-lg text-white ${isStory ? "pr-20" : ""}`}>
                          {comp.name}
                        </h3>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0
                          ${isSelected ? "border-primary bg-primary" : "border-muted-foreground bg-transparent"}
                        `}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>

                      {/* Companion type (only story comps have a meaningful type label) */}
                      {isStory && comp.type && (
                        <p className="text-zinc-400 text-xs mb-1">{comp.type}</p>
                      )}

                      <div className="flex text-accent mb-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${rarityBadgeClass(comp.rarity)}`}>
                          {rarityLabel(comp.rarity)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Heart size={14} className="text-red-400" />
                          <span>{comp.hp}/{comp.maxHp}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Sword size={14} className="text-orange-400" />
                          <span>{comp.attack}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Shield size={14} className="text-blue-400" />
                          <span>{comp.defense}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Zap size={14} className="text-cyan-400" />
                          <span>{comp.speed}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* EXP bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 uppercase font-bold tracking-widest">
                      <span>Lv {comp.level}</span>
                      <span>{comp.experience}/{comp.expToNext} EXP</span>
                    </div>
                    <Progress value={(comp.experience / comp.expToNext) * 100} className="h-1.5" />
                  </div>

                  {/* Equipped gear */}
                  {compEquip.length > 0 && (
                    <div className="mt-3 p-2 bg-background/50 rounded border border-border/30 text-xs text-zinc-400 space-y-1">
                      <span className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Equipped Gear</span>
                      {compEquip.map(e => (
                        <div key={e.id} className="flex justify-between">
                          <span>{e.name}</span>
                          <span className="text-zinc-500 capitalize">{e.type.replace("_", " ")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lore blurb (story) OR skill block (gacha) */}
                  {isStory && lore ? (
                    <div className="mt-3 p-2 bg-amber-950/20 rounded border border-amber-700/20 text-xs text-amber-200/80 italic leading-relaxed">
                      &ldquo;{lore}&rdquo;
                      {comp.skill && (
                        <p className="mt-1.5 not-italic text-zinc-400 text-[11px]">
                          <span className="text-amber-400 font-bold mr-1">Skill:</span>{comp.skill}
                        </p>
                      )}
                    </div>
                  ) : comp.skill ? (
                    <div className="mt-3 p-2 bg-background/50 rounded text-xs text-zinc-400 border border-border/30">
                      <span className="text-accent mr-2 font-bold">Skill:</span>
                      {comp.skill}
                    </div>
                  ) : null}

                  {/* Action row */}
                  <div className="mt-auto pt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-purple-900/30 text-purple-400 font-bold"
                      onClick={(e) => { e.stopPropagation(); upgradeComp(comp.id); }}
                      disabled={upgradePending || (player?.warriorSouls || 0) < 10}
                    >
                      <Hammer size={14} className="mr-2" /> Upgrade
                    </Button>
                    {/* Story companions cannot be dismissed — they are unique and irreplaceable */}
                    {!comp.isInParty && !isStory && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-900/30 text-red-400 px-3"
                        onClick={(e) => { e.stopPropagation(); recycleComp(comp.id); }}
                        disabled={recyclePending}
                        title="Dismiss for souls"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
