import { usePlayer, usePlayerFullStatus, useEquipment, useTransformations, useUpgradeStat, useBulkUpgradeStats } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Shield, Sword, Coins, Wheat, Trophy, Zap, Heart, Sparkles, RefreshCcw, BookOpen, Users, Info, Plus, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
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

export default function Home() {
  const { data: player, isLoading } = usePlayer();
  const { data: teamStatus } = usePlayerFullStatus();
  const { data: equipment } = useEquipment();
  const { data: transforms } = useTransformations();
  const upgradeStat = useUpgradeStat();
  const bulkUpgrade = useBulkUpgradeStats();
  const { toast } = useToast();

  const [pendingUpgrades, setPendingUpgrades] = useState<Record<string, number>>({});

  const getStatUpgradeCost = (currentVal: number) => {
    return Math.floor((currentVal - 1) / 10) + 2;
  };

  const stagedInfo = useMemo(() => {
    if (!teamStatus?.player) return { totalCost: 0, pointsLeft: 0 };
    let cost = 0;
    let tempPoints = teamStatus.player.statPoints;
    const stats = { ...pendingUpgrades };
    
    // We need to calculate cost sequentially because it increases
    const entries = Object.entries(pendingUpgrades);
    entries.forEach(([stat, amount]) => {
      let val = (teamStatus.player as any)[stat];
      for(let i=0; i<amount; i++) {
        cost += getStatUpgradeCost(val + i);
      }
    });

    return {
      totalCost: cost,
      pointsLeft: teamStatus.player.statPoints - cost
    };
  }, [pendingUpgrades, teamStatus?.player]);

  const handleStageUpgrade = (stat: string) => {
    const currentVal = (teamStatus?.player as any)[stat] + (pendingUpgrades[stat] || 0);
    if (currentVal >= 99) return;
    
    const cost = getStatUpgradeCost(currentVal);
    if (stagedInfo.pointsLeft < cost) {
      toast({
        title: "Not enough points",
        description: `You need ${cost} points for this upgrade.`,
        variant: "destructive"
      });
      return;
    }

    setPendingUpgrades(prev => ({
      ...prev,
      [stat]: (prev[stat] || 0) + 1
    }));
  };

  const handleUnstageUpgrade = (stat: string) => {
    if (!pendingUpgrades[stat]) return;
    setPendingUpgrades(prev => ({
      ...prev,
      [stat]: Math.max(0, prev[stat] - 1)
    }));
  };

  const handleConfirmUpgrades = async () => {
    try {
      await bulkUpgrade.mutateAsync(pendingUpgrades);
      setPendingUpgrades({});
    } catch (e) {}
  };

  const handleCancelUpgrades = () => {
    setPendingUpgrades({});
  };

  const mechanics = [
    {
      icon: Users,
      title: "Recruit Allies",
      desc: "Visit the Shrine to summon unique warrior companions. Build a party of up to 5 warriors to fight by your side."
    },
    {
      icon: Sword,
      title: "Master Combat",
      desc: "Progress through the Campaign Map. Face field bandits, storm castles, and challenge legendary Demon Lords."
    },
    {
      icon: Shield,
      title: "Forge Equipment",
      desc: "Loot weapons and armor from fallen foes. Upgrade and endow your gear at the Armory to increase your power."
    },
    {
      icon: Zap,
      title: "Spirit Bonds",
      desc: "Manage war horses and spirit pets in the Stable. They provide vital stat bonuses and unique skills in battle."
    }
  ];

  const handleRestart = async () => {
    try {
      await apiRequest('POST', '/api/restart');
      queryClient.invalidateQueries();
      toast({
        title: "Ascension Complete",
        description: "Your spirit has passed its strength to the next generation.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "The ritual was interrupted. Try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-muted-foreground font-display">Gathering Intel...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!player) return null;

  const statCards = [
    { label: "Level", value: player.level, icon: Trophy, color: "text-purple-400" },
    { label: "HP", value: teamStatus?.player ? `${teamStatus.player.hp}/${teamStatus.player.maxHp}` : `${player.hp}/${player.maxHp}`, icon: Heart, color: "text-red-400", bonus: (teamStatus?.player as any)?.permStats?.hp || 0 },
    { label: "ATK", value: teamStatus?.player?.attack || player.attack, icon: Sword, color: "text-orange-400", bonus: (teamStatus?.player as any)?.permStats?.attack || 0 },
    { label: "DEF", value: teamStatus?.player?.defense || player.defense, icon: Shield, color: "text-blue-400", bonus: (teamStatus?.player as any)?.permStats?.defense || 0 },
    { label: "SPD", value: teamStatus?.player?.speed || player.speed, icon: Zap, color: "text-cyan-400", bonus: (teamStatus?.player as any)?.permStats?.speed || 0 },
    { label: "Gold", value: (player.gold || 0).toLocaleString(), icon: Coins, color: "text-yellow-400" },
    { label: "Rice", value: (player.rice || 0).toLocaleString(), icon: Wheat, color: "text-green-400" },
  ];

  const coreStats = teamStatus?.player ? [
    { key: 'str', label: "STR", value: teamStatus.player.str, color: "text-red-500", description: "Strength: Increases Physical ATK", bonus: (teamStatus.player as any).strBonus || 0 },
    { key: 'agi', label: "AGI", value: teamStatus.player.agi, color: "text-orange-400", description: "Agility: Increases Flee and Speed", bonus: (teamStatus.player as any).agiBonus || 0 },
    { key: 'vit', label: "VIT", value: teamStatus.player.vit, color: "text-green-500", description: "Vitality: Increases Max HP and Soft DEF", bonus: (teamStatus.player as any).vitBonus || 0 },
    { key: 'int', label: "INT", value: teamStatus.player.int, color: "text-blue-400", description: "Intelligence: Increases MATK and Soft MDEF", bonus: (teamStatus.player as any).intBonus || 0 },
    { key: 'dex', label: "DEX", value: teamStatus.player.dex, color: "text-yellow-500", description: "Dexterity: Increases HIT and Status ATK", bonus: (teamStatus.player as any).dexBonus || 0 },
    { key: 'luk', label: "LUK", value: teamStatus.player.luk, color: "text-purple-400", description: "Luck: Increases Critical Rate and Perfect Dodge", bonus: (teamStatus.player as any).lukBonus || 0 },
  ] : [];

  const derivedStats = teamStatus?.player ? [
    { label: "ATK", value: teamStatus.player.attack, formula: "STR + DEX/5 + LUK/3" },
    { label: "MATK", value: teamStatus.player.statusMATK, formula: "1.5 * INT + DEX/5 + LUK/3" },
    { label: "DEF", value: teamStatus.player.defense, formula: "VIT/2 + AGI/5" },
    { label: "MDEF", value: teamStatus.player.softMDEF, formula: "INT + VIT/5 + DEX/5" },
    { label: "HIT", value: teamStatus.player.hit, formula: "175 + LVL + DEX + LUK/3" },
    { label: "FLEE", value: teamStatus.player.flee, formula: "100 + LVL + AGI + LUK/5" },
    { label: "CRIT", value: `${teamStatus.player.critChance}%`, formula: "0.3 * LUK" },
    { label: "ASPD", value: teamStatus.player.speed, formula: "SPD + AGI/2" },
  ] : [];

  const equippedItems = equipment?.filter(e => e.isEquipped && e.equippedToType === 'player') || [];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'gold': return 'text-yellow-400 border-yellow-700';
      case 'purple': return 'text-purple-400 border-purple-700';
      case 'blue': return 'text-blue-400 border-blue-700';
      case 'green': return 'text-green-400 border-green-700';
      default: return 'text-zinc-400 border-zinc-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'weapon': return Sword;
      case 'armor': return Shield;
      case 'accessory': return Sparkles;
      case 'horse_gear': return Zap;
      default: return Sword;
    }
  };

  const expToNext = Math.floor(100 * Math.pow(1.25, (player.level || 1) - 1));
  const expPercent = player.level > 0 ? Math.min(100, (player.experience / expToNext) * 100) : 0;

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">Daimyo's Quarters</h1>
            <p className="text-muted-foreground">Review your current standing and resources.</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-accent/50 text-accent hover:bg-accent/10">
                <BookOpen size={16} />
                How to Play
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

                <div className="p-6 bg-accent/5 border border-accent/20 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-accent/10 rounded border border-accent/20">
                      <Info className="text-accent" size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-2 tracking-wide uppercase">Core Loop</h4>
                      <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                        Master the Sengoku era through this cycle:
                      </p>
                      <ol className="space-y-3">
                        <li className="flex items-center gap-3 text-xs text-zinc-300 font-bold uppercase tracking-wider">
                          <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0 text-[10px]">1</span>
                          Fight battles to earn Gold & Equipment
                        </li>
                        <li className="flex items-center gap-3 text-xs text-zinc-300 font-bold uppercase tracking-wider">
                          <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0 text-[10px]">2</span>
                          Upgrade your gear in the Armory
                        </li>
                        <li className="flex items-center gap-3 text-xs text-zinc-300 font-bold uppercase tracking-wider">
                          <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0 text-[10px]">3</span>
                          Summon allies and manage your Stable
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-lg overflow-hidden border border-border/50 shadow-2xl h-64 sm:h-72"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 w-full flex justify-between items-end">
            <div>
              <div className="inline-block px-3 py-1 bg-primary/20 border border-primary/30 rounded text-primary text-xs font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
                Lord of the Realm
              </div>
              <h2 className="text-4xl font-display font-bold text-white text-shadow-sm mb-2" data-testid="text-player-name">{player.firstName || 'Wandering Samurai'}</h2>
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
                  <span>EXP</span>
                  <span>{player.experience} / {expToNext}</span>
                </div>
                <Progress value={expPercent} className="h-2" />
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-white" data-testid="button-restart">
                  <RefreshCcw size={16} className="mr-2" />
                  Seppuku (Restart)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-destructive/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive font-display">Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400 space-y-2">
                    <p>This will permanently delete all your companions, equipment, pets, and current progress.</p>
                    <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-destructive-foreground">
                      <p className="font-bold text-xs uppercase tracking-wider mb-1">Ancestral Inheritance</p>
                      <p className="text-sm">You will gain <span className="font-bold">10% of your current stats</span> as a permanent bonus for your next incarnation. These bonuses stack every time you perform Seppuku.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700">Withdraw</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestart} className="bg-destructive hover:bg-destructive/90 text-white">
                    Accept Fate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>

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
              {stat.bonus && stat.bonus > 0 && (
                <span className="text-[10px] text-accent font-bold mt-1">
                  +{stat.bonus} Ancestral
                </span>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-xl p-6 bg-washi relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-2">
              <Sword size={80} className="opacity-5 absolute top-0 right-0" />
              {teamStatus?.player && (
                <div className="bg-primary/20 border border-primary/30 rounded px-3 py-1 backdrop-blur-sm z-10 flex flex-col items-center">
                  <span className="text-[10px] text-primary-foreground font-bold uppercase tracking-wider">Stat Points</span>
                  <span className="text-xl font-display font-bold text-white">{stagedInfo.pointsLeft}</span>
                  {stagedInfo.totalCost > 0 && (
                    <span className="text-[10px] text-red-400 font-bold">-{stagedInfo.totalCost} staged</span>
                  )}
                </div>
              )}
            </div>
            <h3 className="text-xl font-display font-semibold mb-6 flex items-center gap-2">
              <Trophy size={20} className="text-primary" />
              Core Attributes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coreStats.map((stat) => {
                const staged = pendingUpgrades[stat.key] || 0;
                const currentTotal = stat.value + staged;
                const cost = getStatUpgradeCost(currentTotal);
                const canAfford = stagedInfo.pointsLeft >= cost;
                const isMax = currentTotal >= 99;

                return (
                  <div key={stat.label} className="bg-background/40 border border-border/30 rounded-lg p-3 group hover:border-primary/50 transition-colors flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${stat.color}`}>{stat.label}</span>
                        <span className="text-lg font-display font-bold text-white">{stat.value}</span>
                        {staged > 0 && <span className="text-lg font-display font-bold text-primary"> +{staged}</span>}
                        {stat.bonus > 0 && <span className="text-xs text-accent font-bold">({stat.bonus})</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{stat.description}</p>
                    </div>
                    
                    {!isMax && teamStatus?.player && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex gap-1">
                          {staged > 0 && (
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-7 w-7 rounded border-muted-foreground/20 hover:bg-muted/20"
                              onClick={() => handleUnstageUpgrade(stat.key)}
                            >
                              <ChevronDown size={14} className="text-muted-foreground" />
                            </Button>
                          )}
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className={`h-7 w-7 rounded border-primary/20 hover:bg-primary/20 ${!canAfford ? 'opacity-30' : ''}`}
                            disabled={!canAfford}
                            onClick={() => handleStageUpgrade(stat.key)}
                          >
                            <ChevronUp size={14} className="text-primary" />
                          </Button>
                        </div>
                        <div className="text-[9px] font-bold text-primary/70">{cost}P</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {stagedInfo.totalCost > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex justify-end gap-3 border-t border-border/30 pt-6"
              >
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-white"
                  onClick={handleCancelUpgrades}
                >
                  <X size={16} className="mr-2" />
                  Discard Changes
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90 text-white"
                  onClick={handleConfirmUpgrades}
                  disabled={bulkUpgrade.isPending}
                >
                  <Check size={16} className="mr-2" />
                  Confirm & Save Stats ({stagedInfo.totalCost} pts)
                </Button>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-xl p-6 bg-washi relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Shield size={80} />
            </div>
            <h3 className="text-xl font-display font-semibold mb-6 flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              Derived Combat Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {derivedStats.map((stat) => (
                <div key={stat.label} className="bg-background/40 border border-border/30 rounded-lg p-3 flex flex-col items-center justify-center text-center group relative cursor-help">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</span>
                  <span className="text-xl font-display font-bold text-white">{stat.value}</span>
                  <div className="absolute -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded text-[8px] text-accent font-mono z-20 pointer-events-none whitespace-nowrap border border-accent/20">
                    {stat.formula}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {teamStatus?.pet && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Active Pet</h3>
            <div className="bg-card border border-accent/30 rounded-lg p-4 bg-washi flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-full border border-accent/30">
                <Sparkles size={24} className="text-accent" />
              </div>
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
              <div className="p-3 bg-cyan-900/20 rounded-full border border-cyan-700/30">
                <Zap size={24} className="text-cyan-400" />
              </div>
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
                  <p className="text-xs text-muted-foreground mt-1">Lv{t.level} | {t.durationSeconds}s duration | {t.cooldownSeconds}s cooldown</p>
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
