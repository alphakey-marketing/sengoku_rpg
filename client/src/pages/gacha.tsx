import { useState } from "react";
import { usePlayer, useGachaPull, useEquipmentGachaPull, Companion, Equipment } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Star, Wheat, Sword, Shield, Gem, Zap, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export default function GachaPage() {
  const { data: player } = usePlayer();
  const { mutate: pullCompanion, isPending: isPullingCompanion } = useGachaPull();
  const { mutate: pullEquipment, isPending: isPullingEquipment } = useEquipmentGachaPull();
  
  const [companionResult, setCompanionResult] = useState<Companion | null>(null);
  const [equipmentResult, setEquipmentResult] = useState<Equipment | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState<'companion' | 'equipment'>('companion');

  const handleCompanionPull = () => {
    setCompanionResult(null);
    setEquipmentResult(null);
    setIsAnimating(true);
    
    setTimeout(() => {
      pullCompanion(undefined, {
        onSuccess: (data) => {
          setCompanionResult(data.companion);
          setIsAnimating(false);
        },
        onError: () => setIsAnimating(false)
      });
    }, 1500);
  };

  const handleEquipmentPull = () => {
    setCompanionResult(null);
    setEquipmentResult(null);
    setIsAnimating(true);
    
    setTimeout(() => {
      pullEquipment(undefined, {
        onSuccess: (data) => {
          setEquipmentResult(data.equipment);
          setIsAnimating(false);
        },
        onError: () => setIsAnimating(false)
      });
    }, 1500);
  };

  const companionCost = 10;
  const equipmentCost = 15;
  const canAffordCompanion = (player?.rice || 0) >= companionCost;
  const canAffordEquipment = (player?.rice || 0) >= equipmentCost;

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'gold': return 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10';
      case 'purple': return 'text-purple-400 border-purple-400/50 bg-purple-400/10';
      case 'blue': return 'text-blue-400 border-blue-400/50 bg-blue-400/10';
      case 'green': return 'text-green-400 border-green-400/50 bg-green-400/10';
      default: return 'text-zinc-400 border-zinc-400/50 bg-zinc-400/10';
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] max-w-4xl mx-auto py-8">
        
        <div className="text-center mb-8 w-full">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-accent mb-4 text-shadow-glow">
            {activeTab === 'companion' ? 'Shrine of Summons' : 'Shrine of Steel'}
          </h1>
          <p className="text-lg text-zinc-300">
            {activeTab === 'companion' 
              ? 'Offer rice to attract legendary warriors to your banner.' 
              : 'The sacred forge offers legendary equipment to those who sacrifice.'}
          </p>
          
          <div className="flex justify-center gap-4 mt-8">
            <Button 
              variant={activeTab === 'companion' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('companion'); setCompanionResult(null); setEquipmentResult(null); }}
              className={activeTab === 'companion' ? 'bg-primary border-accent text-white' : 'border-border'}
            >
              Summon Companion
            </Button>
            <Button 
              variant={activeTab === 'equipment' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('equipment'); setCompanionResult(null); setEquipmentResult(null); }}
              className={activeTab === 'equipment' ? 'bg-primary border-accent text-white' : 'border-border'}
            >
              Forge Equipment
            </Button>
          </div>

          <div className="inline-flex items-center gap-3 mt-6 bg-card border border-border/50 px-6 py-3 rounded-full">
            <span className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Treasury</span>
            <div className="flex items-center gap-2 text-xl font-bold text-green-400">
              <Wheat size={20} />
              {player?.rice?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        {/* Summon Area */}
        <div className="relative w-full max-w-md aspect-[3/4] flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl"></div>
          
          <AnimatePresence mode="wait">
            {!companionResult && !equipmentResult && !isAnimating && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative z-10 flex flex-col items-center"
              >
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-accent/30 animate-[spin_10s_linear_infinite] mb-8 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-2 border-primary/50 flex items-center justify-center animate-[spin_5s_linear_infinite_reverse]">
                    {activeTab === 'companion' ? (
                      <Sparkles className="text-accent animate-pulse" size={32} />
                    ) : (
                      <Gem className="text-purple-400 animate-pulse" size={32} />
                    )}
                  </div>
                </div>
                
                <Button 
                  onClick={activeTab === 'companion' ? handleCompanionPull : handleEquipmentPull}
                  disabled={activeTab === 'companion' ? (!canAffordCompanion || isPullingCompanion) : (!canAffordEquipment || isPullingEquipment)}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-12 py-8 rounded-full text-xl font-bold border border-accent/50 shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all group"
                >
                  <span className="mr-3">{activeTab === 'companion' ? 'Summon Warrior' : 'Forge Special Gear'}</span>
                  <div className="flex items-center text-accent group-hover:text-white transition-colors text-base bg-black/30 px-3 py-1 rounded-full">
                    <Wheat size={16} className="mr-1" /> {activeTab === 'companion' ? companionCost : equipmentCost}
                  </div>
                </Button>
                
                {activeTab === 'companion' ? (
                  !canAffordCompanion && <p className="text-destructive mt-4 text-sm font-medium">Need more rice.</p>
                ) : (
                  !canAffordEquipment && <p className="text-destructive mt-4 text-sm font-medium">Need more rice.</p>
                )}
              </motion.div>
            )}

            {isAnimating && (
              <motion.div 
                key="animating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-10 text-center"
              >
                <div className={`w-40 h-40 mx-auto rounded-full ${activeTab === 'companion' ? 'bg-accent/20' : 'bg-purple-900/20'} flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(212,175,55,0.6)]`}>
                  {activeTab === 'companion' ? (
                    <Sparkles className="text-accent animate-ping" size={48} />
                  ) : (
                    <Sword className="text-purple-400 animate-bounce" size={48} />
                  )}
                </div>
                <h2 className="text-2xl font-display font-bold text-accent tracking-widest animate-pulse">
                  {activeTab === 'companion' ? 'INCANTING...' : 'FORGING...'}
                </h2>
              </motion.div>
            )}

            {companionResult && !isAnimating && (
              <motion.div 
                key="companion-result"
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="relative z-10 w-full"
              >
                <div className="bg-card border-2 border-accent rounded-xl p-8 text-center shadow-[0_0_40px_rgba(212,175,55,0.3)] bg-washi">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background border-2 border-accent px-4 py-1 rounded-full text-accent font-bold text-sm tracking-widest uppercase">
                    New Ally
                  </div>
                  <h2 className="text-4xl font-display font-bold text-white mb-2 mt-4">{companionResult.name}</h2>
                  <p className="text-primary font-medium tracking-widest uppercase text-sm mb-6">{companionResult.type} Hero</p>
                  <div className="flex justify-center gap-1 text-accent mb-6">
                    {Array.from({ length: companionResult.rarity }).map((_, j) => (
                      <motion.div key={j} initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + (j * 0.1) }}>
                        <Star size={28} fill="currentColor" />
                      </motion.div>
                    ))}
                  </div>

                  {companionResult.skill && (
                    <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={16} className="text-accent" />
                        <span className="text-sm font-bold text-accent uppercase tracking-wider">{companionResult.skill}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{(companionResult as any).skillType}</Badge>
                      </div>
                      <p className="text-xs text-zinc-300 leading-snug">
                        {(companionResult as any).skillEffect === 'atk_buff' && `Increases party attack by ${(companionResult as any).skillValue}%`}
                        {(companionResult as any).skillEffect === 'def_buff' && `Increases party defense by ${(companionResult as any).skillValue}%`}
                        {(companionResult as any).skillEffect === 'spd_debuff' && `Reduces enemy speed by ${(companionResult as any).skillValue}%`}
                        {!(companionResult as any).skillEffect && "Active combat technique."}
                      </p>
                    </div>
                  )}

                  <Button onClick={() => setCompanionResult(null)} variant="outline" className="w-full border-accent text-accent hover:bg-accent/10">Summon Again</Button>
                </div>
              </motion.div>
            )}

            {equipmentResult && !isAnimating && (
              <motion.div 
                key="equipment-result"
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="relative z-10 w-full"
              >
                <div className="bg-card border-2 border-accent rounded-xl p-8 text-center shadow-[0_0_40px_rgba(212,175,55,0.3)] bg-washi">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background border-2 border-accent px-4 py-1 rounded-full text-accent font-bold text-sm tracking-widest uppercase">
                    Forged Item
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white mb-2 mt-4">{equipmentResult.name}</h2>
                  <Badge className={`mb-6 uppercase tracking-widest ${getRarityColor(equipmentResult.rarity)}`}>
                    {equipmentResult.rarity}
                  </Badge>
                  
                  <div className="grid grid-cols-2 gap-4 text-left bg-background/50 p-4 rounded-lg border border-border/50 mb-8">
                    <div className="flex items-center gap-2">
                      <Sword size={16} className="text-red-400" />
                      <div><span className="text-muted-foreground text-[10px] uppercase block">Attack</span><p className="font-bold text-red-400">+{equipmentResult.attackBonus}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-blue-400" />
                      <div><span className="text-muted-foreground text-[10px] uppercase block">Defense</span><p className="font-bold text-blue-400">+{equipmentResult.defenseBonus}</p></div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Zap size={16} className="text-green-400" />
                      <div><span className="text-muted-foreground text-[10px] uppercase block">Speed</span><p className="font-bold text-green-400">+{equipmentResult.speedBonus}</p></div>
                    </div>
                  </div>
                  
                  <Button onClick={() => setEquipmentResult(null)} variant="outline" className="w-full border-accent text-accent hover:bg-accent/10">Forge Again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
