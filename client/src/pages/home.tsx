import { usePlayer, usePlayerFullStatus, useEquipment, useTransformations, useUpgradeStat, useBulkUpgradeStats, useCompanions } from "@/hooks/use-game";
import { useStoryFlags, useStoryChapters } from "@/hooks/use-story";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Shield, Sword, Coins, Wheat, Trophy, Zap, Heart, Sparkles,
  RefreshCcw, BookOpen, Users, Info, ChevronUp, ChevronDown,
  Check, X, AlertTriangle, Flame, Crown, Wind,
} from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContextualTips } from "@/components/home/contextual-tips";
import { StoryProgressBanner } from "@/components/home/story-progress-banner";
import { statUpgradeCost, totalUpgradeCost } from "@shared/stat-cost";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { credentials: "include", ...options, headers });
}

// ── Thematic stat definitions ────────────────────────────────────────────────
const THEMATIC_STATS = [
  {
    key: "force",
    dbKey: "str",
    label: "Force",
    icon: Flame,
    color: "text-red-400",
    borderHover: "hover:border-red-500/50",
    description: "Raw power shaped by ruthless choices. Drives damage, weapon mastery, and critical strikes.",
    bonusPctKey: "forceBonusPct",
    bonusLabel: "Ruthlessness",
    bonusColor: "text-red-300",
  },
  {
    key: "influence",
    dbKey: "int",
    label: "Influence",
    icon: Crown,
    color: "text-amber-400",
    borderHover: "hover:border-amber-500/50",
    description: "Political acumen shaped by strategic choices. Reduces enemy cohesion and boosts resource gains.",
    bonusPctKey: "influenceBonusPct",
    bonusLabel: "Political Power",
    bonusColor: "text-amber-300",
  },
  {
    key: "spirit",
    dbKey: "agi",
    label: "Spirit",
    icon: Wind,
    color: "text-cyan-400",
    borderHover: "hover:border-cyan-500/50",
    description: "Supernatural resilience shaped by mystical choices. Drives HP, dodge, and initiative.",
    bonusPctKey: "spiritBonusPct",
    bonusLabel: "Supernatural",
    bonusColor: "text-cyan-300",
  },
];

export default function Home() {
  const { data: player, isLoading, error, refetch } = usePlayer();
  const { data: teamStatus } = usePlayerFullStatus();
  const { data: equipment = [] } = useEquipment();
  const { data: transforms } = useTransformations();
  const { data: companions = [] } = useCompanions();
  const { data: flags = [] } = useStoryFlags();
  const { data: chapters = [] } = useStoryChapters();
  const upgradeStat = useUpgradeStat();
  const bulkUpgrade = useBulkUpgradeStats();
  const { toast } = useToast();

  const [pendingUpgrades, setPendingUpgrades] = useState<Record<string, number>>({});

  const stagedInfo = useMemo(() => {
    // FIX: use only player.statPoints (GET /api/player) as the source of truth.
    // teamStatus.player.statPoints is a combat snapshot that can be stale
    // immediately after an upgrade while React Query is still refetching.
    const basePoints = player?.statPoints ?? 0;
    let cost = 0;
    for (const [key, amount] of Object.entries(pendingUpgrades)) {
      const stat = THEMATIC_STATS.find(s => s.key === key);
      const currentVal =
        (teamStatus?.player as any)?.[key]
        ?? (teamStatus?.player as any)?.[stat?.dbKey ?? key]
        ?? 1;
      cost += totalUpgradeCost(currentVal, amount);
    }
    return { totalCost: cost, pointsLeft: basePoints - cost };
  }, [pendingUpgrades, teamStatus?.player, player?.statPoints]);

  const handleStageUpgrade = (statKey: string, dbKey: string) => {
    const currentVal =
      (teamStatus?.player as any)?.[statKey]
      ?? (teamStatus?.player as any)?.[dbKey]
      ?? 1;
    const staged  = pendingUpgrades[statKey] || 0;
    const nextVal = currentVal + staged;
    if (nextVal >= 99) return;
    const cost = statUpgradeCost(nextVal);
    if (stagedInfo.pointsLeft < cost) {
      toast({
        title: "Not enough stat points",
        description: `Need ${cost} point${cost > 1 ? "s" : ""} — only ${stagedInfo.pointsLeft} remaining.`,
        variant: "destructive",
      });
      return;
    }
    setPendingUpgrades(prev => ({ ...prev, [statKey]: staged + 1 }));
  };

  const handleUnstageUpgrade = (statKey: string) => {
    if (!pendingUpgrades[statKey]) return;
    setPendingUpgrades(prev => {
      const next = { ...prev };
      if (next[statKey] <= 1) {
        // FIX: delete the key entirely instead of leaving { key: 0 },
        // which could cause a stale-currentVal miscalculation in stagedInfo.
        delete next[statKey];
      } else {
        next[statKey] -= 1;
      }
      return next;
    });
  };

  const handleConfirmUpgrades = async () => {
    const dbMapped: Record<string, number> = {};
    for (const [key, amt] of Object.entries(pendingUpgrades)) {
      const stat = THEMATIC_STATS.find(s => s.key === key);
      if (amt > 0) dbMapped[stat?.dbKey ?? key] = amt;
    }
    try {
      await bulkUpgrade.mutateAsync(dbMapped);
      setPendingUpgrades({});
    } catch {}
  };

  const handleCancelUpgrades = () => setPendingUpgrades({});

  const mechanics = [
    { icon: Users,  title: "Recruit Allies",   desc: "Visit the Shrine to summon unique warrior companions. Build a party of up to 5 warriors to fight by your side." },
    { icon: Sword,  title: "Master Combat",    desc: "Progress through the Campaign Map. Face field bandits, storm castles, and challenge legendary Demon Lords." },
    { icon: Shield, title: "Forge Equipment",  desc: "Loot weapons and armor from fallen foes. Upgrade and endow your gear at the Armory to increase your power." },
    { icon: Zap,    title: "Spirit Bonds",     desc: "Manage war horses and spirit pets in the Stable. They provide vital stat bonuses and unique skills in battle." },
  ];

  const handleRestart = async () => {
    try {
      const res = await fetchWithAuth("/api/restart", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries();
      toast({ title: "Ritual Complete", description: "Your journey begins anew, unburdened by the past." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "The ritual was interrupted. Try again." });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-muted-foreground font-display">Gathering Intel...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!player) {
    return (
      <MainLayout>
        <div className="h-64 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 bg-destructive/10 rounded-full border border-destructive/30">
            <AlertTriangle size={32} className="text-destructive" />
          </div>
          <div>
            <p className="text-white font-display text-lg font-semibold mb-1">Failed to load your profile</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              {error ? String(error) : "Your warrior data could not be retrieved."}
            </p>
          </div>
          <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => refetch()}>
            <RefreshCcw size={16} className="mr-2" />Retry
          </Button>
        </div>
      </MainLayout>
    );
  }

  const statCards = [
    { label: "Level",  value: player.level,  icon: Trophy, color: "text-purple-400" },
    { label: "HP",     value: teamStatus?.player ? `${teamStatus.player.hp}/${teamStatus.player.maxHp}` : `${player.hp}/${player.maxHp}`, icon: Heart, color: "text-red-400" },
    { label: "ATK",    value: teamStatus?.player?.attack   || player.attack,   icon: Sword,  color: "text-orange-400" },
    { label: "DEF",    value: teamStatus?.player?.defense  || player.defense,  icon: Shield, color: "text-blue-400" },
    { label: "SPD",    value: teamStatus?.player?.speed    || player.speed,    icon: Zap,    color: "text-cyan-400" },
    { label: "Gold",   value: (player.gold || 0).toLocaleString(),             icon: Coins,  color: "text-yellow-400" },
    { label: "Rice",   value: (player.rice || 0).toLocaleString(),             icon: Wheat,  color: "text-green-400" },
  ];

  const combatSummary = teamStatus?.player ? [
    {
      label: "Damage",
      value: teamStatus.player.attack,
      sub:   `Force ${(teamStatus.player as any).force ?? (teamStatus.player as any).str ?? "—"} + weapon`,
      color: "text-red-400",
      icon:  Sword,
    },
    {
      label: "Resilience",
      value: teamStatus.player.defense,
      sub:   `Spirit ${(teamStatus.player as any).spirit ?? (teamStatus.player as any).agi ?? "—"} driven`,
      color: "text-blue-400",
      icon:  Shield,
    },
    {
      label: "Swiftness",
      value: teamStatus.player.speed,
      sub:   `${(teamStatus.player as any).flee ?? "—"} flee / ${Math.round((teamStatus.player as any).critChance ?? 0)}% crit`,
      color: "text-cyan-400",
      icon:  Zap,
    },
  ] : [];

  const expToNext  = Math.floor(100 * Math.pow(1.25, (player.level || 1) - 1));
  const expPercent = player.level > 0 ? Math.min(100, (player.experience / expToNext) * 100) : 0;

  return (
    <MainLayout>
      <div className="space-y-8">

        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">
              Daimyo's Quarters
            </h1>
            <p className="text-muted-foreground">Review your current standing and resources.</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-accent/50 text-accent hover:bg-accent/10">
                <BookOpen size={16} />How to Play
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-center text-white border-b border-border/50 pb-4">
                  Sengoku Chronicles Guide
                </DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {mechanics.map((m, i) => (
                    <div key={i} className="bg-black/20 border border-border/30 p-4 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-primary/10 border border-primary/20 rounded-md">
                          <m.icon className="text-primary" size={20} />
                        </div>
                        <h4 className="font-display font-bold text-white tracking-wide">{m.title}</h4>
                      </div>
                      <p className="text-zinc-400 text-xs leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-lg overflow-hidden border border-border/50 shadow-2xl h-64 sm:h-72"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 w-full flex justify-between items-end">
            <div>
              <div className="inline-block px-3 py-1 bg-primary/20 border border-primary/30 rounded text-primary text-xs font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
                Lord of the Realm
              </div>
              <h2 className="text-4xl font-display font-bold text-white text-shadow-sm mb-2" data-testid="text-player-name">
                {player.firstName || "Wandering Samurai"}
              </h2>
              <div className="flex items-center gap-4">
                <p className="text-accent text-lg font-medium text-shadow">Level {player.level}</p>
                {teamStatus?.player && (teamStatus.player as any).seppukuCount > 0 && (
                  <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                    <RefreshCcw size={12} className="mr-1" />
                    Incarnation {(teamStatus.player as any).seppukuCount}
                  </Badge>
                )}
              </div>
              <div className="mt-2 w-48">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>EXP</span><span>{player.experience} / {expToNext}</span>
                </div>
                <Progress value={expPercent} className="h-2" />
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-white" data-testid="button-restart">
                  <RefreshCcw size={16} className="mr-2" />Seppuku (Restart)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-destructive/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive font-display">Confirm Final Sacrifice</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400 space-y-2">
                    <p>This will permanently delete all your companions, equipment, pets, and current progress.</p>
                    <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                      <p className="font-bold text-xs uppercase tracking-wider mb-1">Total Reset</p>
                      <p className="text-sm">There are <span className="font-bold">no permanent bonuses</span> passed down.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700">Withdraw</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestart} className="bg-destructive hover:bg-destructive/90 text-white">Accept Fate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>

        <ContextualTips player={player} companions={companions} equipment={equipment} flags={flags} />

        {/* War Resources */}
        <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mt-12 mb-6">War Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border/50 rounded-lg p-4 flex flex-col items-center justify-center text-center hover-elevate bg-washi"
              data-testid={`stat-${stat.label.toLowerCase()}`}
            >
              <div className={`p-2 rounded-full bg-background/50 border border-border mb-3 ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">{stat.label}</p>
              <p className="text-lg font-bold font-display text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <StoryProgressBanner flags={flags} chapters={chapters} />

        {/* Warlord's Identity + Battle Readiness */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">

          {/* Left: Force / Influence / Spirit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-xl p-6 bg-washi relative overflow-hidden h-full flex flex-col"
          >
            <div className="absolute top-0 right-0 p-4">
              <Flame size={80} className="opacity-5 absolute top-0 right-0" />
            </div>

            <div className="absolute top-4 right-4 bg-primary/20 border border-primary/30 rounded px-3 py-1 text-center z-10" data-testid="container-stat-points">
              <span className="text-[10px] text-primary-foreground font-bold uppercase tracking-wider block">Stat Points</span>
              <span className="text-xl font-display font-bold text-white">{stagedInfo.pointsLeft}</span>
              {stagedInfo.totalCost > 0 && (
                <span className="text-[10px] text-red-400 font-bold block">−{stagedInfo.totalCost} staged</span>
              )}
            </div>

            <h3 className="text-xl font-display font-semibold mb-2 flex items-center gap-2">
              <Trophy size={20} className="text-primary" />
              Warlord's Identity
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Shaped by your story choices — every decision leaves a permanent mark.
            </p>

            <div className="flex flex-col gap-4 flex-1">
              {THEMATIC_STATS.map((stat) => {
                const currentVal =
                  (teamStatus?.player as any)?.[stat.key]
                  ?? (teamStatus?.player as any)?.[stat.dbKey]
                  ?? 1;
                const staged   = pendingUpgrades[stat.key] || 0;
                const nextVal  = currentVal + staged;
                const cost     = statUpgradeCost(nextVal);
                const canAfford = stagedInfo.pointsLeft >= cost;
                const isMax    = nextVal >= 99;
                const bonusPct = (teamStatus?.player as any)?.[stat.bonusPctKey] ?? 0;
                const Icon = stat.icon;

                return (
                  <TooltipProvider key={stat.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`bg-background/40 border border-border/30 rounded-lg p-4 ${stat.borderHover} transition-colors flex items-center gap-4`}>
                          <div className={`p-2 rounded-full bg-background/60 border border-border/40 flex-shrink-0 ${stat.color}`}>
                            <Icon size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className={`text-sm font-bold uppercase tracking-widest ${stat.color}`}>{stat.label}</span>
                              <span className="text-2xl font-display font-bold text-white">{currentVal}</span>
                              {staged > 0 && (
                                <span className="text-lg font-display font-bold text-primary">+{staged}</span>
                              )}
                            </div>
                            {bonusPct > 0 && (
                              <span className={`text-[10px] font-bold ${stat.bonusColor}`}>
                                +{bonusPct}% from {stat.bonusLabel}
                              </span>
                            )}
                          </div>
                          {!isMax && teamStatus?.player && (
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <div className="flex gap-1">
                                {staged > 0 ? (
                                  <button
                                    className="h-7 w-7 flex items-center justify-center rounded border border-muted-foreground/20 hover:bg-muted/20 transition-colors"
                                    onClick={() => handleUnstageUpgrade(stat.key)}
                                    data-testid={`button-unstage-${stat.key}`}
                                  >
                                    <ChevronDown size={14} className="text-muted-foreground" />
                                  </button>
                                ) : (
                                  <div className="h-7 w-7" />
                                )}
                                <button
                                  className={`h-7 w-7 flex items-center justify-center rounded border border-primary/20 hover:bg-primary/20 transition-colors ${
                                    !canAfford ? "opacity-30 cursor-not-allowed" : ""
                                  }`}
                                  disabled={!canAfford}
                                  onClick={() => handleStageUpgrade(stat.key, stat.dbKey)}
                                  data-testid={`button-stage-${stat.key}`}
                                >
                                  <ChevronUp size={14} className="text-primary" />
                                </button>
                              </div>
                              <div className="text-[9px] font-bold text-primary/70">{cost}P</div>
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-card border-border p-3 shadow-xl max-w-xs">
                        <p className="text-xs text-zinc-300 leading-relaxed">{stat.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>

            {stagedInfo.totalCost > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex justify-end gap-3 border-t border-border/30 pt-4"
              >
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white" onClick={handleCancelUpgrades} data-testid="button-discard-upgrades">
                  <X size={16} className="mr-2" />Discard
                </Button>
                <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={handleConfirmUpgrades} disabled={bulkUpgrade.isPending} data-testid="button-apply-upgrades">
                  <Check size={16} className="mr-2" />Apply ({stagedInfo.totalCost} pts)
                </Button>
              </motion.div>
            )}
          </motion.div>

          {/* Right: Battle Readiness */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border/50 rounded-xl p-6 bg-washi relative overflow-hidden h-full flex flex-col"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Shield size={80} />
            </div>
            <h3 className="text-xl font-display font-semibold mb-2 flex items-center gap-2">
              <Sparkles size={20} className="text-primary" />
              Battle Readiness
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Derived from your identity stats and equipped gear.
            </p>
            <div className="flex flex-col gap-4 flex-1">
              {combatSummary.map((s) => (
                <div
                  key={s.label}
                  className="bg-background/40 border border-border/30 rounded-lg p-4 flex items-center gap-4"
                  data-testid={`combat-stat-${s.label.toLowerCase()}`}
                >
                  <div className={`p-2 rounded-full bg-background/60 border border-border/40 flex-shrink-0 ${s.color}`}>
                    <s.icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{s.label}</p>
                    <p className="text-2xl font-display font-bold text-white">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                  </div>
                </div>
              ))}
              {teamStatus?.player && (
                <div className="mt-2 p-3 bg-amber-900/10 border border-amber-700/20 rounded-lg">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Story Bonuses Active</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "forceBonusPct",     label: "Force",     color: "text-red-300",   bg: "bg-red-900/40" },
                      { key: "influenceBonusPct", label: "Influence", color: "text-amber-300", bg: "bg-amber-900/40" },
                      { key: "spiritBonusPct",    label: "Spirit",    color: "text-cyan-300",  bg: "bg-cyan-900/40" },
                    ].map(({ key, label, color, bg }) => {
                      const pct = (teamStatus.player as any)[key] ?? 0;
                      return (
                        <span key={key} className={`text-xs px-2 py-0.5 rounded-full border border-white/10 ${bg} ${color} ${pct === 0 ? "opacity-30" : ""}`}>
                          {label} {pct > 0 ? `+${pct}%` : "—"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {teamStatus?.pet && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Active Pet</h3>
            <div className="bg-card border border-accent/30 rounded-lg p-4 bg-washi flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-full border border-accent/30"><Sparkles size={24} className="text-accent" /></div>
              <div>
                <p className="font-bold text-white">{teamStatus.pet.name}</p>
                <p className="text-xs text-muted-foreground">Lv{teamStatus.pet.level} | ATK {teamStatus.pet.attack} | DEF {teamStatus.pet.defense} | SPD {teamStatus.pet.speed}</p>
                {teamStatus.pet.skill && <p className="text-xs text-accent mt-1">Skill: {teamStatus.pet.skill}</p>}
              </div>
            </div>
          </div>
        )}

        {teamStatus?.horse && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Active Horse</h3>
            <div className="bg-card border border-cyan-700/30 rounded-lg p-4 bg-washi flex items-center gap-4">
              <div className="p-3 bg-cyan-900/20 rounded-full border border-cyan-700/30"><Zap size={24} className="text-cyan-400" /></div>
              <div>
                <p className="font-bold text-white">{teamStatus.horse.name}</p>
                <p className="text-xs text-muted-foreground">Lv{teamStatus.horse.level} | +{teamStatus.horse.speedBonus} SPD | +{teamStatus.horse.attackBonus} ATK</p>
                {teamStatus.horse.skill && <p className="text-xs text-cyan-400 mt-1">Skill: {teamStatus.horse.skill}</p>}
              </div>
            </div>
          </div>
        )}

        {transforms && transforms.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Transformations (変身)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {transforms.map(t => (
                <div key={t.id} className="bg-card border border-purple-700/40 rounded-lg p-4 bg-washi shadow-[0_0_15px_rgba(128,0,255,0.1)]">
                  <p className="font-bold text-purple-300 text-lg font-display">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Lv{t.level} | {t.durationSeconds}s | {t.cooldownSeconds}s cd</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <span className="text-red-400">+{t.attackPercent}% ATK</span>
                    <span className="text-blue-400">+{t.defensePercent}% DEF</span>
                    <span className="text-cyan-400">+{t.speedPercent}% SPD</span>
                    <span className="text-green-400">+{t.hpPercent}% HP</span>
                  </div>
                  <p className="text-xs text-accent mt-2">Skill: {t.skill}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
