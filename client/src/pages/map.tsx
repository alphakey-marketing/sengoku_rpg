import { useState } from "react";
import { useFieldBattle, useBossBattle, useSpecialBossBattle, BattleResult } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Swords, Skull, ChevronRight, Crown, Zap, Shield, Heart, Sparkles, ArrowUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

const LOCATIONS = [
  { id: 1, name: "Owari Province", desc: "Starting grounds of the Oda clan. Bandits and minor yokai roam here.", level: 1 },
  { id: 2, name: "Mino Province", desc: "Mountainous terrain hiding fierce warrior monks and elite guards.", level: 5 },
  { id: 3, name: "Kyoto Approaches", desc: "The capital's outskirts. Heavily defended by the Shogun's remnants.", level: 10 },
  { id: 4, name: "Demon Gate (鬼門)", desc: "A cursed portal where legendary yokai lurk. Special bosses drop transformation stones.", level: 15 },
];

export default function MapPage() {
  const { mutate: doFieldBattle, isPending: fieldPending } = useFieldBattle();
  const { mutate: doBossBattle, isPending: bossPending } = useBossBattle();
  const { mutate: doSpecialBoss, isPending: specialPending } = useSpecialBossBattle();

  const [result, setResult] = useState<BattleResult | null>(null);

  const handleBattle = (type: 'field' | 'boss' | 'special', locationId: number) => {
    const action = type === 'field' ? doFieldBattle : type === 'boss' ? doBossBattle : doSpecialBoss;
    action(locationId, {
      onSuccess: (data) => setResult(data)
    });
  };

  const isPending = fieldPending || bossPending || specialPending;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="border-b border-border/50 pb-4 flex items-center gap-3">
          <MapIcon className="text-accent" size={32} />
          <div>
            <h1 className="text-3xl font-display font-bold text-white" data-testid="text-page-title">Campaign Map</h1>
            <p className="text-muted-foreground">Choose a territory to attack. Boss battles yield higher rewards. Special bosses drop transformation stones.</p>
          </div>
        </div>

        <div className="space-y-4 mt-8">
          {LOCATIONS.map((loc) => (
            <div
              key={loc.id}
              className={`bg-card border rounded-lg p-1 flex flex-col md:flex-row bg-washi hover:border-border transition-colors ${loc.id === 4 ? 'border-purple-700/50 shadow-[0_0_20px_rgba(128,0,255,0.1)]' : 'border-border/50'}`}
            >
              <div
                className="h-32 md:h-auto md:w-48 bg-cover bg-center rounded-md m-1 opacity-80"
                style={{ backgroundImage: `url(https://images.unsplash.com/photo-1578469645742-46cae010e5d4?q=80&w=800&auto=format&fit=crop)` }}
              />

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-display font-bold text-white">{loc.name}</h2>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-bold">Rec. Lv {loc.level}</span>
                    {loc.id === 4 && <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded font-bold border border-purple-700/30">Special</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">{loc.desc}</p>
                </div>

                <div className="flex flex-wrap gap-3 mt-auto">
                  <Button
                    onClick={() => handleBattle('field', loc.id)}
                    disabled={isPending}
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10 text-zinc-200"
                    data-testid={`battle-field-${loc.id}`}
                  >
                    <Swords size={16} className="mr-2 text-primary" />
                    Field Skirmish
                  </Button>
                  <Button
                    onClick={() => handleBattle('boss', loc.id)}
                    disabled={isPending}
                    className="bg-secondary hover:bg-secondary/80 text-white"
                    data-testid={`battle-boss-${loc.id}`}
                  >
                    <Skull size={16} className="mr-2 text-accent" />
                    Assault Castle
                  </Button>
                  {loc.id === 4 && (
                    <Button
                      onClick={() => handleBattle('special', loc.id)}
                      disabled={isPending}
                      className="bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 border border-purple-700/40 shadow-[0_0_12px_rgba(128,0,255,0.2)]"
                      data-testid={`battle-special-${loc.id}`}
                    >
                      <Crown size={16} className="mr-2 text-purple-400" />
                      Challenge Demon Lord
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={result !== null} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className={`font-display text-2xl border-b border-border/50 pb-4 text-center ${result?.victory ? 'text-accent' : 'text-destructive'}`}>
              {result?.victory ? 'GLORIOUS VICTORY' : 'DEFEAT'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-4">
            {result?.enemyTeam && (
              <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">Enemy Forces</h4>
                {result.enemyTeam.enemies.map((e, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm">
                    <span className="font-bold text-white">{e.name}</span>
                    <span className="text-zinc-400">Lv{e.level}</span>
                    <div className="flex gap-3 text-xs text-zinc-500">
                      <span><Heart size={12} className="inline text-red-400 mr-1" />{e.hp}</span>
                      <span><Swords size={12} className="inline text-orange-400 mr-1" />{e.attack}</span>
                      <span><Shield size={12} className="inline text-blue-400 mr-1" />{e.defense}</span>
                      <span><Zap size={12} className="inline text-cyan-400 mr-1" />{e.speed}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-background/80 rounded p-4 border border-border/30 font-mono text-sm space-y-2">
              <AnimatePresence>
                {result?.logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-2"
                  >
                    <ChevronRight size={14} className="mt-0.5 shrink-0 text-primary" />
                    <span className="text-zinc-300">{log}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {result?.victory && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (result.logs.length * 0.1) + 0.3 }}
                className="bg-primary/5 border border-primary/20 rounded-lg p-4"
              >
                <h3 className="text-accent font-bold text-sm tracking-widest uppercase mb-3">Spoils of War</h3>
                <div className="flex gap-6 mb-4 flex-wrap">
                  <div>
                    <span className="text-xs text-muted-foreground">Experience</span>
                    <p className="font-bold text-purple-400">+{result.experienceGained}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Gold Looted</span>
                    <p className="font-bold text-yellow-400">+{result.goldGained}</p>
                  </div>
                  {(result.riceGained ?? 0) > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Rice</span>
                      <p className="font-bold text-green-400">+{result.riceGained}</p>
                    </div>
                  )}
                  {(result.equipmentExpGained ?? 0) > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Gear EXP</span>
                      <p className="font-bold text-cyan-400"><ArrowUp size={12} className="inline mr-1" />+{result.equipmentExpGained}</p>
                    </div>
                  )}
                </div>

                {result.equipmentDropped && result.equipmentDropped.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-muted-foreground block mb-2">Equipment Recovered</span>
                    <div className="flex flex-col gap-2">
                      {result.equipmentDropped.map((eq, i) => (
                        <div key={i} className="flex items-center justify-between bg-background p-2 rounded border border-border/50 text-sm">
                          <span className="font-bold">{eq.name}</span>
                          <div className="flex items-center gap-2">
                            {eq.attackBonus > 0 && <span className="text-xs text-red-400">+{eq.attackBonus} ATK</span>}
                            {eq.defenseBonus > 0 && <span className="text-xs text-blue-400">+{eq.defenseBonus} DEF</span>}
                            {eq.speedBonus > 0 && <span className="text-xs text-cyan-400">+{eq.speedBonus} SPD</span>}
                            <span className="text-xs px-2 py-0.5 bg-muted rounded uppercase">{eq.rarity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.petDropped && (
                  <div className="mb-3 bg-accent/5 border border-accent/20 rounded p-3">
                    <span className="text-xs text-accent font-bold block mb-1">Pet Captured!</span>
                    <span className="font-bold text-white">{result.petDropped.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">ATK {result.petDropped.attack} | DEF {result.petDropped.defense} | SPD {result.petDropped.speed}</span>
                  </div>
                )}

                {result.horseDropped && (
                  <div className="mb-3 bg-cyan-900/10 border border-cyan-700/20 rounded p-3">
                    <span className="text-xs text-cyan-400 font-bold block mb-1">Horse Tamed!</span>
                    <span className="font-bold text-white">{result.horseDropped.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">+{result.horseDropped.speedBonus} SPD | +{result.horseDropped.attackBonus} ATK</span>
                  </div>
                )}

                {result.transformationDropped && (
                  <div className="bg-purple-900/20 border border-purple-700/30 rounded p-3 shadow-[0_0_15px_rgba(128,0,255,0.15)]">
                    <span className="text-xs text-purple-400 font-bold block mb-1">Transformation Stone Acquired!</span>
                    <span className="font-bold text-purple-300 text-lg">{result.transformationDropped.name}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      +{result.transformationDropped.attackPercent}% ATK | +{result.transformationDropped.defensePercent}% DEF |
                      +{result.transformationDropped.speedPercent}% SPD | +{result.transformationDropped.hpPercent}% HP
                    </p>
                    <p className="text-xs text-accent mt-1">Skill: {result.transformationDropped.skill}</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
            <Button onClick={() => setResult(null)} className="w-full sm:w-auto" data-testid="button-return">Return to Camp</Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
