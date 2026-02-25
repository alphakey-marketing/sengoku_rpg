import { useState } from "react";
import { useCompanions, useSetParty, useEquipment, usePlayer, useRecycleCompanion, useUpgradeCompanion, Companion } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Users, Star, Sword, Shield, Zap, Heart, Trash2, Hammer, Flame, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
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

export default function Party() {
  const { data: player } = usePlayer();
  const { data: companions, isLoading } = useCompanions();
  const { data: equipment } = useEquipment();
  const { mutate: setParty, isPending } = useSetParty();
  const { mutate: recycleComp, isPending: recyclePending } = useRecycleCompanion();
  const { mutate: upgradeComp, isPending: upgradePending } = useUpgradeCompanion();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isRecycling, setIsRecycling] = useState(false);
  const [activeTab, setActiveTab] = useState<'party' | 'horses' | 'pets' | 'transform'>('party');

  const handleRecycleRarity = async (rarities: string[]) => {
    setIsRecycling(true);
    try {
      const res = await apiRequest('POST', '/api/companions/recycle-rarity', { rarities });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: [api.companions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      toast({ 
        title: "Recycle Complete", 
        description: `Dismissed ${data.count} warriors and gained ${data.soulsGained} Warrior Souls.` 
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to recycle warriors." });
    } finally {
      setIsRecycling(false);
    }
  };

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

  const getCompEquipped = (compId: number) => equipment?.filter(e => e.isEquipped && e.equippedToType === 'companion' && e.equippedToId === compId) || [];

  if (isLoading) return <MainLayout><div className="p-8">Loading companions...</div></MainLayout>;

  const sortedComps = companions ? [...companions].sort((a, b) => a.id - b.id) : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">War Council</h1>
            <div className="flex gap-4 mb-2">
              <button 
                onClick={() => setActiveTab('party')} 
                className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'party' ? 'border-primary text-white' : 'border-transparent text-muted-foreground hover:text-white'}`}
              >
                Party
              </button>
              <button 
                onClick={() => setActiveTab('horses')} 
                className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'horses' ? 'border-primary text-white' : 'border-transparent text-muted-foreground hover:text-white'}`}
              >
                Horses
              </button>
              <button 
                onClick={() => setActiveTab('pets')} 
                className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'pets' ? 'border-primary text-white' : 'border-transparent text-muted-foreground hover:text-white'}`}
              >
                Pets
              </button>
              <button 
                onClick={() => setActiveTab('transform')} 
                className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'transform' ? 'border-primary text-white' : 'border-transparent text-muted-foreground hover:text-white'}`}
              >
                Transform
              </button>
            </div>
            <p className="text-muted-foreground">
              {activeTab === 'party' ? 'Select up to 5 unique warriors for your active party.' : 
               activeTab === 'horses' ? 'Manage your stable and select your mount.' :
               activeTab === 'pets' ? 'Manage your battle pets and spirit companions.' :
               'Configure your transformation abilities.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'party' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-red-900/50 text-red-400 hover:bg-red-900/20" disabled={isRecycling}>
                    <RefreshCw size={16} className="mr-2" />
                    Recycle All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Recycle Warriors</AlertDialogTitle>
                    <AlertDialogDescription>
                      Select which rarities to dismiss. Active party members will not be recycled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="grid grid-cols-1 gap-2 py-4">
                    {[
                      { stars: 1, label: "Common", rarity: "1", color: "text-zinc-400" },
                      { stars: 2, label: "Uncommon", rarity: "2", color: "text-green-400" },
                      { stars: 3, label: "Rare", rarity: "3", color: "text-blue-400" },
                      { stars: 4, label: "Epic", rarity: "4", color: "text-purple-400" },
                      { stars: 5, label: "Legendary", rarity: "5", color: "text-yellow-400" },
                    ].map((r) => (
                      <Button
                        key={r.rarity}
                        variant="outline"
                        className="justify-between hover:bg-red-900/10 border-border/50"
                        onClick={() => handleRecycleRarity([r.rarity])}
                      >
                        <div className="flex items-center gap-2">
                          <span className={r.color}>{r.label}</span>
                          <div className="flex text-amber-500">
                            {Array.from({ length: r.stars }).map((_, i) => <Star key={i} size={10} fill="currentColor" />)}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Recycle All</span>
                      </Button>
                    ))}
                    <Button
                      variant="destructive"
                      className="mt-2"
                      onClick={() => handleRecycleRarity(["1", "2", "3", "4", "5"])}
                    >
                      Recycle EVERYONE (Not in Party)
                    </Button>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

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

        {activeTab === 'party' && (
          sortedComps.length === 0 ? (
            <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-white mb-2">No Companions Yet</h3>
              <p className="text-muted-foreground">Visit the Shrine to summon allies to your cause.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedComps.map((comp, i) => {
                const isSelected = selectedIds.includes(comp.id);
                const compEquip = getCompEquipped(comp.id);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={comp.id}
                    className={`
                      relative rounded-lg p-5 transition-all duration-300 border bg-washi flex flex-col
                      ${isSelected
                        ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                        : 'bg-card border-border/50 hover:border-accent/40'}
                    `}
                    data-testid={`companion-card-${comp.id}`}
                  >
                    <div className="flex gap-4 cursor-pointer" onClick={() => toggleSelection(comp.id)}>
                      <div className="w-16 h-16 rounded bg-background border border-border flex items-center justify-center shrink-0">
                        <Users className={isSelected ? 'text-primary' : 'text-muted-foreground'} size={32} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold font-display text-lg text-white">{comp.name}</h3>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                            ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'}
                          `}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                        <div className="flex text-accent mb-3">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                            comp.rarity === "5" ? 'text-orange-500 border-orange-500 bg-orange-500/10 shadow-[0_0_10px_rgba(255,165,0,0.3)]' :
                            comp.rarity === "4" ? 'text-purple-400 border-purple-400 bg-purple-400/10' :
                            comp.rarity === "3" ? 'text-blue-400 border-blue-400 bg-blue-400/10' :
                            comp.rarity === "2" ? 'text-green-500 border-green-500 bg-green-500/10' :
                            'text-zinc-400 border-zinc-700 bg-zinc-800/50'
                          }`}>
                            {comp.rarity}-Star
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

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 uppercase font-bold tracking-widest">
                        <span>Lv {comp.level}</span>
                        <span>{comp.experience}/{comp.expToNext} EXP</span>
                      </div>
                      <Progress value={(comp.experience / comp.expToNext) * 100} className="h-1.5" />
                    </div>

                    {compEquip.length > 0 && (
                      <div className="mt-3 p-2 bg-background/50 rounded border border-border/30 text-xs text-zinc-400 space-y-1">
                        <span className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Equipped Gear</span>
                        {compEquip.map(e => (
                          <div key={e.id} className="flex justify-between">
                            <span>{e.name}</span>
                            <span className="text-zinc-500 capitalize">{e.type.replace('_', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {comp.skill && (
                      <div className="mt-3 p-2 bg-background/50 rounded text-xs text-zinc-400 border border-border/30">
                        <span className="text-accent mr-2 font-bold">Skill:</span>
                        {comp.skill}
                      </div>
                    )}

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
                      {!comp.isInParty && (
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
          )
        )}

        {activeTab !== 'party' && (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <h3 className="text-lg font-medium text-white mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</h3>
            <p className="text-muted-foreground">This section is currently being organized by the Council.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
