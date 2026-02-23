import { usePets, useHorses, useSetActivePet, useSetActiveHorse, useTransformations } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Star, Heart, Sword, Shield, Crown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

export default function StablePage() {
  const { data: pets, isLoading: petsLoading } = usePets();
  const { data: horses, isLoading: horsesLoading } = useHorses();
  const { data: transforms } = useTransformations();
  const { mutate: setActivePet, isPending: petPending } = useSetActivePet();
  const { mutate: setActiveHorse, isPending: horsePending } = useSetActiveHorse();

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
                        <div className="flex text-cyan-400 items-center gap-1">
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/30">
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
            {!transforms || transforms.length === 0 ? (
              <EmptyState icon={Crown} title="No Transformations" desc="Defeat special bosses at the Demon Gate to acquire transformation stones." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {transforms.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-purple-700/40 p-5 bg-washi bg-card shadow-[0_0_20px_rgba(128,0,255,0.08)]"
                    data-testid={`transform-card-${t.id}`}
                  >
                    <h3 className="font-bold text-xl font-display text-purple-300 mb-1">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">Lv {t.level} | {t.durationSeconds}s Duration | {t.cooldownSeconds}s Cooldown</p>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <span className="text-red-400">+{t.attackPercent}% ATK</span>
                      <span className="text-blue-400">+{t.defensePercent}% DEF</span>
                      <span className="text-cyan-400">+{t.speedPercent}% SPD</span>
                      <span className="text-green-400">+{t.hpPercent}% HP</span>
                    </div>

                    <div className="bg-background/50 rounded p-2 border border-purple-700/20">
                      <p className="text-xs"><span className="text-purple-400 font-bold">Skill: </span>{t.skill}</p>
                    </div>

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
                ))}
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
