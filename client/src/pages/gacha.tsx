import { useState } from "react";
import { usePlayer, useGachaPull, useEquipmentGachaPull, Companion, Equipment } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Star, Wheat, Sword, Shield, Gem, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function GachaPage() {
  const { data: player } = usePlayer();
  const { mutate: pullCompanion, isPending: isPullingCompanion } = useGachaPull();
  const { mutate: pullEquipment, isPending: isPullingEquipment } = useEquipmentGachaPull();
  
  const [companionResult, setCompanionResult] = useState<Companion | null>(null);
  const [equipmentResult, setEquipmentResult] = useState<Equipment | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState<'companion' | 'special' | 'equipment' | 'exchange'>('companion');
  const { toast } = useToast();

  const handleCompanionPull = (isSpecial: boolean = false) => {
    setCompanionResult(null);
    setEquipmentResult(null);
    setIsAnimating(true);
    
    setTimeout(() => {
      pullCompanion({ isSpecial }, {
        onSuccess: (data: any) => {
          setCompanionResult(data.companion);
          setIsAnimating(false);
        },
        onError: (error: any) => {
          setIsAnimating(false);
          toast({
            title: "Summon Failed",
            description: error.message || "An unexpected error occurred",
            variant: "destructive"
          });
        }
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
  const specialCost = 50;
  const equipmentCost = 15;
  const canAffordCompanion = (player?.rice || 0) >= companionCost;
  const canAffordSpecial = (player?.rice || 0) >= specialCost;
  const canAffordEquipment = (player?.rice || 0) >= equipmentCost;

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'gold': return 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10';
      case 'purple': return 'text-purple-400 border-purple-400/50 bg-purple-400/10';
      case 'blue': return 'text-blue-400 border-blue-400/50 bg-blue-400/10';
      case 'green': return 'text-green-400 border-green-400/50 bg-green-400/10';
      case 'mythic': return 'text-pink-400 border-pink-400/50 bg-pink-400/10';
    case 'exotic': return 'text-teal-400 border-teal-400/50 bg-teal-400/10';
    case 'transcendent': return 'text-white border-white/50 bg-white/10 animate-pulse';
    case 'celestial': return 'text-blue-200 border-blue-200/50 bg-blue-200/10 shadow-[0_0_15px_rgba(191,219,254,0.5)]';
    case 'primal': return 'text-red-500 border-red-500/50 bg-black shadow-[0_0_20px_rgba(239,68,68,0.5)]';
    default: return 'text-zinc-400 border-zinc-400/50 bg-zinc-400/10';
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] max-w-4xl mx-auto py-8">
        
        <div className="text-center mb-8 w-full">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-accent mb-4 text-shadow-glow">
            {activeTab === 'companion' ? 'Shrine of Summons' : activeTab === 'special' ? 'Imperial Rite' : 'Shrine of Steel'}
          </h1>
          <p className="text-lg text-zinc-300">
            {activeTab === 'companion' 
              ? 'Offer rice to attract legendary warriors to your banner.' 
              : activeTab === 'special'
              ? 'Perform a sacred ritual to summon elite warriors with superior growth.'
              : 'The sacred forge offers legendary equipment to those who sacrifice.'}
          </p>
          
          <div className="flex justify-center flex-wrap gap-4 mt-8">
            <Button 
              variant={activeTab === 'companion' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('companion'); setCompanionResult(null); setEquipmentResult(null); }}
              className={activeTab === 'companion' ? 'bg-primary border-accent text-white' : 'border-border'}
            >
              Summon Companion
            </Button>
            <Button 
              variant={activeTab === 'special' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('special'); setCompanionResult(null); setEquipmentResult(null); }}
              className={activeTab === 'special' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 border-yellow-400 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'border-border'}
            >
              <Sparkles size={16} className="mr-2" />
              Special Summon
            </Button>
            <Button 
              variant={activeTab === 'equipment' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('equipment'); setCompanionResult(null); setEquipmentResult(null); }}
              className={activeTab === 'equipment' ? 'bg-primary border-accent text-white' : 'border-border'}
            >
              Forge Equipment
            </Button>
            <Button 
              variant={activeTab === 'exchange' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('exchange'); setCompanionResult(null); setEquipmentResult(null); }}
              className={activeTab === 'exchange' ? 'bg-primary border-accent text-white' : 'border-border'}
            >
              Sacred Exchange
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
                    ) : activeTab === 'special' ? (
                      <Star className="text-yellow-400 animate-pulse" size={32} />
                    ) : activeTab === 'equipment' ? (
                      <Gem className="text-purple-400 animate-pulse" size={32} />
                    ) : (
                      <RefreshCw className="text-amber-400 animate-pulse" size={32} />
                    )}
                  </div>
                </div>
                
                {activeTab !== 'exchange' ? (
                  <Button 
                    onClick={activeTab === 'companion' ? () => handleCompanionPull(false) : activeTab === 'special' ? () => handleCompanionPull(true) : handleEquipmentPull}
                    disabled={
                      activeTab === 'companion' ? (!canAffordCompanion || isPullingCompanion) : 
                      activeTab === 'special' ? (!canAffordSpecial || isPullingCompanion) :
                      (!canAffordEquipment || isPullingEquipment)
                    }
                    className={`bg-gradient-to-r ${activeTab === 'special' ? 'from-amber-600 to-yellow-700 shadow-[0_0_25px_rgba(234,179,8,0.5)]' : 'from-primary to-secondary shadow-[0_0_20px_rgba(220,38,38,0.4)]'} hover:from-primary/90 hover:to-secondary/90 text-white px-12 py-8 rounded-full text-xl font-bold border border-accent/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all group`}
                  >
                    <span className="mr-3">
                      {activeTab === 'companion' ? 'Summon Warrior' : activeTab === 'special' ? 'Perform Rite' : 'Forge Special Gear'}
                    </span>
                    <div className="flex items-center text-accent group-hover:text-white transition-colors text-base bg-black/30 px-3 py-1 rounded-full">
                      <Wheat size={16} className="mr-1" /> {activeTab === 'companion' ? companionCost : activeTab === 'special' ? specialCost : equipmentCost}
                    </div>
                  </Button>
                ) : (
                  <Button 
                    onClick={() => {
                      if (player && player.rice >= 2000) {
                        apiRequest("POST", "/api/player/exchange-stones", {}).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/player"] });
                          toast({ title: "Exchange Success", description: "Exchanged 2000 Rice for 1 Endowment Stone" });
                        });
                      }
                    }}
                    disabled={(player?.rice || 0) < 2000}
                    className="bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-white px-12 py-8 rounded-full text-xl font-bold border border-amber-500/50 shadow-[0_0_20px_rgba(180,83,9,0.4)] transition-all group"
                  >
                    <span className="mr-3">Exchange for Stone</span>
                    <div className="flex items-center text-amber-200 group-hover:text-white transition-colors text-base bg-black/30 px-3 py-1 rounded-full">
                      <Wheat size={16} className="mr-1" /> 2,000
                    </div>
                  </Button>
                )}
                
                {activeTab === 'companion' ? (
                  !canAffordCompanion && <p className="text-destructive mt-4 text-sm font-medium">Need more rice.</p>
                ) : activeTab === 'special' ? (
                  !canAffordSpecial && <p className="text-destructive mt-4 text-sm font-medium">Need more rice for the Imperial Rite.</p>
                ) : activeTab === 'equipment' ? (
                  !canAffordEquipment && <p className="text-destructive mt-4 text-sm font-medium">Need more rice.</p>
                ) : (
                  (player?.rice || 0) < 2000 && <p className="text-destructive mt-4 text-sm font-medium">Need more rice for exchange.</p>
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
                  <div className="flex justify-center gap-1 text-accent mb-4">
                    {Array.from({ length: Number(companionResult.rarity) }).map((_, j) => (
                      <motion.div key={j} initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + (j * 0.1) }}>
                        <Star size={28} fill="currentColor" />
                      </motion.div>
                    ))}
                  </div>
                  {companionResult.isSpecial && (
                    <Badge className="mb-4 bg-gradient-to-r from-amber-500 to-yellow-600 border-yellow-400 text-white animate-pulse">
                      Elite Growth +25%
                    </Badge>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-left bg-background/50 p-4 rounded-lg border border-border/50 mb-8">
                    <div><span className="text-muted-foreground text-xs uppercase">HP</span><p className="font-bold text-green-400">{companionResult.hp}</p></div>
                    <div><span className="text-muted-foreground text-xs uppercase">ATK</span><p className="font-bold text-red-400">{companionResult.attack}</p></div>
                    <div><span className="text-muted-foreground text-xs uppercase">DEF</span><p className="font-bold text-blue-400">{companionResult.defense}</p></div>
                    <div><span className="text-muted-foreground text-xs uppercase">SPD</span><p className="font-bold text-cyan-400">{companionResult.speed}</p></div>
                  </div>
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
                    <div><span className="text-muted-foreground text-xs uppercase">Attack</span><p className="font-bold text-red-400">+{equipmentResult.attackBonus}</p></div>
                    <div><span className="text-muted-foreground text-xs uppercase">Defense</span><p className="font-bold text-blue-400">+{equipmentResult.defenseBonus}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground text-xs uppercase">Speed</span><p className="font-bold text-green-400">+{equipmentResult.speedBonus}</p></div>
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
