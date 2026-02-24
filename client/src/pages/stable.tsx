import { usePets, useHorses, useSetActivePet, useSetActiveHorse, useTransformations, usePlayer } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Star, Heart, Sword, Shield, Crown, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { api } from "@shared/routes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function StablePage() {
  const { data: player } = usePlayer();
  const { data: pets, isLoading: petsLoading } = usePets();
  const { data: horses, isLoading: horsesLoading } = useHorses();
  const { data: transforms } = useTransformations();
  const { mutate: setActivePet, isPending: petPending } = useSetActivePet();
  const { mutate: setActiveHorse, isPending: horsePending } = useSetActiveHorse();
  const { toast } = useToast();

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

  const isLoading = petsLoading || horsesLoading;

  if (isLoading) return <MainLayout><div className="p-8">Opening stable...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-border/50 pb-4">
          <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">War Mounts</h1>
          <p className="text-muted-foreground">Manage your war horses and transformation forms. Only one horse can be active at a time.</p>
        </div>

        <Tabs defaultValue="horses" className="w-full">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="horses" className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-400" data-testid="tab-horses">
              <Zap size={16} className="mr-2" /> Horses ({horses?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="transforms" className="data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-400" data-testid="tab-transforms">
              <Crown size={16} className="mr-2" /> Transformations ({transforms?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="horses" className="mt-6">
            {!horses || horses.length === 0 ? (
              <EmptyState icon={Zap} title="No Horses" desc="Rare horses can be tamed during field battles." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {horses.map((horse, i) => (
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

                    {!horse.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-cyan-700/30 text-cyan-400 hover:bg-cyan-900/20"
                        onClick={() => setActiveHorse(horse.id)}
                        disabled={horsePending}
                        data-testid={`activate-horse-${horse.id}`}
                      >
                        Set Active
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transforms" className="mt-6">
            <div className="mb-6 p-4 rounded-lg bg-purple-900/10 border border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-500/20">
                  <Sparkles className="text-purple-400" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white">Transformation Stones</h3>
                  <p className="text-sm text-muted-foreground">Consumables that activate your powerful forms for 1 hour.</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {player?.transformationStones || 0}
              </div>
            </div>

            {!transforms || transforms.length === 0 ? (
              <EmptyState icon={Crown} title="No Transformations" desc="Defeat special bosses at the Demon Gate to acquire transformation stones." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transforms.map((t, i) => {
                  const isActive = player?.activeTransformId === t.id && player?.transformActiveUntil && new Date(player.transformActiveUntil) > new Date();
                  const timeLeft = isActive ? Math.max(0, Math.floor((new Date(player!.transformActiveUntil!).getTime() - Date.now()) / 1000 / 60)) : 0;

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`rounded-lg border p-5 bg-washi transition-all ${isActive ? 'border-purple-500 bg-purple-900/10 shadow-[0_0_20px_rgba(128,0,255,0.15)]' : 'border-purple-700/40 bg-card'}`}
                      data-testid={`transform-card-${t.id}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-xl font-display text-purple-300">{t.name}</h3>
                        {isActive && (
                          <div className="flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-800/30 px-2 py-1 rounded">
                            <Timer size={12} />
                            {timeLeft}m LEFT
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">Lv {t.level} | 1 Hour Duration (Real Time)</p>

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
                      >
                        {isActive ? "Active (Refreshing...)" : `Activate Form (10 Stones)`}
                      </Button>

                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>EXP</span>
                          <span>{t.experience}/{t.expToNext}</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${(t.experience / t.expToNext) * 100}%` }} />
                        </div>
                      </div>
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
