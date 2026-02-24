import { usePets, useHorses, useSetActivePet, useSetActiveHorse, useTransformations, usePlayer, useCompanions, useSetParty, useEquipment, useRecycleCompanion, useUpgradeCompanion, useRecyclePet, useUpgradePet } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Star, Heart, Sword, Shield, Crown, Timer, Users, Trash2, Hammer, Flame, FlaskConical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { api } from "@shared/routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";

export default function StablePage() {
  const { data: player } = usePlayer();
  const { data: pets, isLoading: petsLoading } = usePets();
  const { data: horses, isLoading: horsesLoading } = useHorses();
  const { data: transforms } = useTransformations();
  const { data: companions, isLoading: companionsLoading } = useCompanions();
  const { data: equipment } = useEquipment();

  const { mutate: setActivePet, isPending: petPending } = useSetActivePet();
  const { mutate: setActiveHorse, isPending: horsePending } = useSetActiveHorse();
  const { mutate: setParty, isPending: partyPending } = useSetParty();
  const { mutate: recycleComp, isPending: recyclePending } = useRecycleCompanion();
  const { mutate: upgradeComp, isPending: upgradePending } = useUpgradeCompanion();
  const { mutate: recyclePet, isPending: recyclePetPending } = useRecyclePet();
  const { mutate: upgradePet, isPending: upgradePetPending } = useUpgradePet();

  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (companions && selectedIds.length === 0 && companions.some(c => c.isInParty)) {
      setSelectedIds(companions.filter(c => c.isInParty).map(c => c.id));
    }
  }, [companions]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(cId => cId !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleSaveParty = () => {
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

  const useStoneMutation = useMutation({
    mutationFn: async (transformId: number) => {
      const res = await apiRequest("POST", `/api/transformations/${transformId}/use-stone`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
      toast({ title: "Transformation Activated!", description: "You have used a transformation stone." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to transform", description: err.message, variant: "destructive" });
    }
  });

  const isLoading = petsLoading || horsesLoading || companionsLoading;

  if (isLoading) return <MainLayout><div className="p-8">Opening war council...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-border/50 pb-4">
          <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">War Council & Stable</h1>
          <p className="text-muted-foreground">Manage your party, war horses, spirit pets, and transformations in one place.</p>
        </div>

        <Tabs defaultValue="party" className="w-full">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="party" className="data-[state=active]:bg-orange-900/30 data-[state=active]:text-orange-400" data-testid="tab-party">
              <Users size={16} className="mr-2" /> Party ({selectedIds.length}/5)
            </TabsTrigger>
            <TabsTrigger value="horses" className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-400" data-testid="tab-horses">
              <Zap size={16} className="mr-2" /> Horses ({horses?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="pets" className="data-[state=active]:bg-green-900/30 data-[state=active]:text-green-400" data-testid="tab-pets">
              <Heart size={16} className="mr-2" /> Pets ({pets?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="transforms" className="data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-400" data-testid="tab-transforms">
              <Crown size={16} className="mr-2" /> Transformations ({transforms?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="party" className="mt-6 space-y-6">
            <div className="flex justify-between items-center bg-card/30 p-4 rounded-lg border border-border/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-orange-900/20 border border-orange-700/30 px-4 py-2 rounded-lg">
                  <Flame size={18} className="text-orange-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-orange-300 uppercase font-bold tracking-wider leading-none">Warrior Souls</span>
                    <span className="text-lg font-bold text-white leading-none">{player?.warriorSouls || 0}</span>
                  </div>
                </div>
                <span className="text-sm font-medium text-secondary-foreground">
                  {selectedIds.length} / 5 Warriors Selected
                </span>
              </div>
              <Button
                onClick={handleSaveParty}
                disabled={partyPending || selectedIds.length === 0}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                data-testid="button-deploy-party"
              >
                {partyPending ? "Updating..." : "Deploy Party"}
              </Button>
            </div>

            {!companions || companions.length === 0 ? (
              <EmptyState icon={Users} title="No Companions Yet" desc="Visit the Shrine to summon allies to your cause." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...companions].sort((a, b) => a.id - b.id).map((comp, i) => {
                  const isSelected = selectedIds.includes(comp.id);
                  const compEquip = getCompEquipped(comp.id);
                  return (
                    <motion.div
                      key={comp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`relative rounded-lg p-5 transition-all duration-300 border bg-washi flex flex-col ${isSelected ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-card border-border/50 hover:border-accent/40'}`}
                      data-testid={`companion-card-${comp.id}`}
                    >
                      <div className="flex gap-4 cursor-pointer" onClick={() => toggleSelection(comp.id)}>
                        <div className="w-16 h-16 rounded bg-background border border-border flex items-center justify-center shrink-0">
                          <Users className={isSelected ? 'text-primary' : 'text-muted-foreground'} size={32} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold font-display text-lg text-white">{comp.name}</h3>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'}`}>
                              {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                          </div>
                          <div className="flex mb-3">
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
                          <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
                            <div className="flex items-center gap-1"><Heart size={14} className="text-red-400" /><span>{comp.hp}/{comp.maxHp}</span></div>
                            <div className="flex items-center gap-1"><Sword size={14} className="text-orange-400" /><span>{comp.attack}</span></div>
                            <div className="flex items-center gap-1"><Shield size={14} className="text-blue-400" /><span>{comp.defense}</span></div>
                            <div className="flex items-center gap-1"><Zap size={14} className="text-cyan-400" /><span>{comp.speed}</span></div>
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
                          <span className="text-accent mr-2 font-bold">Skill:</span>{comp.skill}
                        </div>
                      )}
                      <div className="mt-auto pt-4 flex gap-2">
                        <Button
                          size="sm" variant="outline" className="flex-1 border-purple-900/30 text-purple-400 font-bold"
                          onClick={(e) => { e.stopPropagation(); upgradeComp(comp.id); }}
                          disabled={upgradePending || (player?.warriorSouls || 0) < 10}
                        >
                          <Hammer size={14} className="mr-2" /> Upgrade
                        </Button>
                        {!comp.isInParty && (
                          <Button
                            size="sm" variant="outline" className="border-red-900/30 text-red-400 px-3"
                            onClick={(e) => { e.stopPropagation(); recycleComp(comp.id); }}
                            disabled={recyclePending} title="Dismiss for souls"
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
          </TabsContent>

          <TabsContent value="horses" className="mt-6">
            {!horses || horses.length === 0 ? (
              <EmptyState icon={Zap} title="No Horses" desc="Rare horses can be tamed during field battles." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...horses].sort((a, b) => a.id - b.id).map((horse, i) => (
                  <motion.div
                    key={horse.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-lg border p-5 bg-washi transition-all ${horse.isActive ? 'border-cyan-700 bg-cyan-900/10 shadow-[0_0_15px_rgba(0,200,255,0.1)]' : 'border-border/50 bg-card'}`}
                    data-testid={`horse-card-${horse.id}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg font-display text-white">{horse.name}</h3>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                            horse.rarity === 'primal' ? 'text-orange-500 border-orange-500 bg-orange-500/10 shadow-[0_0_10px_rgba(255,165,0,0.3)]' :
                            horse.rarity === 'celestial' ? 'text-blue-400 border-blue-400 bg-blue-400/10' :
                            horse.rarity === 'transcendent' ? 'text-purple-400 border-purple-400 bg-purple-400/10' :
                            horse.rarity === 'exotic' ? 'text-red-400 border-red-400 bg-red-400/10' :
                            horse.rarity === 'mythic' ? 'text-pink-400 border-pink-400 bg-pink-400/10' :
                            horse.rarity === 'gold' ? 'text-yellow-400 border-yellow-400 bg-yellow-400/10' :
                            horse.rarity === 'purple' ? 'text-purple-500 border-purple-500 bg-purple-500/10' :
                            horse.rarity === 'blue' ? 'text-blue-500 border-blue-500 bg-blue-500/10' :
                            horse.rarity === 'green' ? 'text-green-500 border-green-500 bg-green-500/10' :
                            'text-zinc-400 border-zinc-700 bg-zinc-800/50'
                          }`}>
                            {horse.rarity}
                          </span>
                        </div>
                      </div>
                      {horse.isActive && <span className="text-xs bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded font-bold border border-cyan-700/30">ACTIVE</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="flex items-center gap-1"><Zap size={14} className="text-cyan-400" /><span>+{horse.speedBonus}% SPD</span></div>
                      <div className="flex items-center gap-1"><Sword size={14} className="text-orange-400" /><span>+{horse.attackBonus}% ATK</span></div>
                      <div className="flex items-center gap-1"><Shield size={14} className="text-blue-400" /><span>+{horse.defenseBonus}% DEF</span></div>
                      <div className="text-xs text-muted-foreground self-center">Lv {horse.level}</div>
                    </div>
                    {horse.skill && <p className="text-xs text-cyan-400 mb-3">Skill: {horse.skill}</p>}
                    <div className="flex gap-2">
                      {!horse.isActive && (
                        <Button
                          size="sm" variant="outline" className="flex-1 border-cyan-700/30 text-cyan-400 hover:bg-cyan-900/20"
                          onClick={() => setActiveHorse(horse.id)} disabled={horsePending}
                          data-testid={`activate-horse-${horse.id}`}
                        >Set Active</Button>
                      )}
                      {horse.isActive && (
                        <Button size="sm" variant="secondary" className="flex-1" disabled>Active</Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pets" className="mt-6 space-y-6">
            <div className="flex justify-between items-center bg-card/30 p-4 rounded-lg border border-border/30">
              <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-700/30 px-4 py-2 rounded-lg">
                <FlaskConical size={18} className="text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-blue-300 uppercase font-bold tracking-wider leading-none">Pet Essence</span>
                  <span className="text-lg font-bold text-white leading-none">{player?.petEssence || 0}</span>
                </div>
              </div>
            </div>

            {!pets || pets.length === 0 ? (
              <EmptyState icon={Heart} title="No Pets" desc="Spirit pets can be found during your travels." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...pets].sort((a, b) => a.id - b.id).map((pet, i) => (
                  <motion.div
                    key={pet.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-lg border p-5 bg-washi transition-all ${pet.isActive ? 'border-green-700 bg-green-900/10 shadow-[0_0_15px_rgba(0,255,0,0.1)]' : 'border-border/50 bg-card'}`}
                    data-testid={`pet-card-${pet.id}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg font-display text-white">{pet.name}</h3>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                            pet.rarity === 'primal' ? 'text-orange-500 border-orange-500 bg-orange-500/10 shadow-[0_0_10px_rgba(255,165,0,0.3)]' :
                            pet.rarity === 'celestial' ? 'text-blue-400 border-blue-400 bg-blue-400/10' :
                            pet.rarity === 'transcendent' ? 'text-purple-400 border-purple-400 bg-purple-400/10' :
                            pet.rarity === 'exotic' ? 'text-red-400 border-red-400 bg-red-400/10' :
                            pet.rarity === 'mythic' ? 'text-pink-400 border-pink-400 bg-pink-400/10' :
                            pet.rarity === 'gold' ? 'text-yellow-400 border-yellow-400 bg-yellow-400/10' :
                            pet.rarity === 'purple' ? 'text-purple-500 border-purple-500 bg-purple-500/10' :
                            pet.rarity === 'blue' ? 'text-blue-500 border-blue-500 bg-blue-500/10' :
                            pet.rarity === 'green' ? 'text-green-500 border-green-500 bg-green-500/10' :
                            'text-zinc-400 border-zinc-700 bg-zinc-800/50'
                          }`}>
                            {
                              pet.rarity === 'white' ? 'COMMON' :
                              pet.rarity === 'green' ? 'UNCOMMON' :
                              pet.rarity === 'blue' ? 'RARE' :
                              pet.rarity === 'purple' ? 'EPIC' :
                              pet.rarity === 'gold' ? 'LEGENDARY' :
                              pet.rarity === 'mythic' ? 'MYTHIC' :
                              pet.rarity === 'exotic' ? 'EXOTIC' :
                              pet.rarity === 'transcendent' ? 'TRANSCENDENT' :
                              pet.rarity === 'celestial' ? 'CELESTIAL' :
                              pet.rarity === 'primal' ? 'PRIMAL' : 'UNKNOWN'
                            }
                          </span>
                        </div>
                      </div>
                      {pet.isActive && <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded font-bold border border-green-700/30">ACTIVE</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="flex items-center gap-1"><Sword size={14} className="text-orange-400" /><span>+{pet.attack} ATK</span></div>
                      <div className="flex items-center gap-1"><Shield size={14} className="text-blue-400" /><span>+{pet.defense} DEF</span></div>
                      <div className="flex items-center gap-1"><Zap size={14} className="text-cyan-400" /><span>+{pet.speed} SPD</span></div>
                      <div className="flex items-center gap-1"><Heart size={14} className="text-red-400" /><span>+{pet.hp} HP</span></div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 uppercase font-bold tracking-widest">
                        <span>Lv {pet.level}</span>
                        <span>{pet.experience}/{pet.expToNext} EXP</span>
                      </div>
                      <Progress value={(pet.experience / pet.expToNext) * 100} className="h-1.5" />
                    </div>

                    {pet.skill && <p className="text-xs text-green-400 mb-3">Skill: {pet.skill}</p>}
                    
                    <div className="flex gap-2">
                      {!pet.isActive && (
                        <Button
                          size="sm" variant="outline" className="flex-1 border-green-700/30 text-green-400 hover:bg-green-900/20"
                          onClick={() => setActivePet(pet.id)} disabled={petPending}
                          data-testid={`activate-pet-${pet.id}`}
                        >Set Active</Button>
                      )}
                      {pet.isActive && (
                        <Button
                          size="sm" variant="secondary" className="flex-1" disabled
                        >Active</Button>
                      )}
                      <Button
                        size="sm" variant="outline" className="border-purple-900/30 text-purple-400 px-3"
                        onClick={() => {
                          const amount = prompt("How much essence to use?", "1");
                          if (amount) {
                            const n = parseInt(amount);
                            if (!isNaN(n) && n > 0) {
                              upgradePet({ id: pet.id, amount: n });
                            }
                          }
                        }}
                        disabled={upgradePetPending || (player?.petEssence || 0) < 1}
                        title="Upgrade with essence"
                        data-testid={`upgrade-pet-${pet.id}`}
                      ><Hammer size={14} /></Button>
                      {!pet.isActive && (
                        <Button
                          size="sm" variant="outline" className="border-red-900/30 text-red-400 px-3"
                          onClick={() => recyclePet(pet.id)} disabled={recyclePetPending}
                          title="Recycle for Essence"
                          data-testid={`recycle-pet-${pet.id}`}
                        ><Trash2 size={14} /></Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transforms" className="mt-6">
            <div className="mb-6 p-4 rounded-lg bg-purple-900/10 border border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-500/20"><Sparkles className="text-purple-400" size={20} /></div>
                <div>
                  <h3 className="font-bold text-white">Transformation Stones</h3>
                  <p className="text-sm text-muted-foreground">Consumables that activate your powerful forms for 1 hour.</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-400">{player?.transformationStones || 0}</div>
            </div>
            {!transforms || transforms.length === 0 ? (
              <EmptyState icon={Crown} title="No Transformations" desc="Defeat special bosses at the Demon Gate." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transforms.map((t, i) => {
                  const isActive = player?.activeTransformId === t.id && player?.transformActiveUntil && new Date(player.transformActiveUntil) > new Date();
                  const timeLeft = isActive ? Math.max(0, Math.floor((new Date(player!.transformActiveUntil!).getTime() - Date.now()) / 1000 / 60)) : 0;
                  return (
                    <motion.div
                      key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className={`rounded-lg border p-5 bg-washi transition-all ${isActive ? 'border-purple-500 bg-purple-900/10 shadow-[0_0_20px_rgba(128,0,255,0.15)]' : 'border-purple-700/40 bg-card'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-xl font-display text-purple-300">{t.name}</h3>
                        {isActive && <div className="flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-800/30 px-2 py-1 rounded"><Timer size={12} />{timeLeft}m LEFT</div>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">Lv {t.level} | 1 Hour Duration</p>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <span className="text-red-400">+{t.attackPercent}% ATK</span>
                        <span className="text-blue-400">+{t.defensePercent}% DEF</span>
                        <span className="text-cyan-400">+{t.speedPercent}% SPD</span>
                        <span className="text-green-400">+{t.hpPercent}% HP</span>
                      </div>
                      <div className="bg-background/50 rounded p-2 border border-purple-700/20 mb-3">
                        <p className="text-xs"><span className="text-purple-400 font-bold">Skill: </span>{t.skill}</p>
                      </div>
                      <Button
                        className={`w-full ${isActive ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-900/40 hover:bg-purple-800/60 border-purple-700/30'}`}
                        disabled={useStoneMutation.isPending || (player?.transformationStones || 0) < 10}
                        onClick={() => useStoneMutation.mutate(t.id)}
                      >{isActive ? "Active" : `Activate Form (10 Stones)`}</Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
      <Icon className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}
