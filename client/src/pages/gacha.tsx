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
  
  const [companionResults, setCompanionResults] = useState<Companion[]>([]);
  const [equipmentResults, setEquipmentResults] = useState<Equipment[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState<'companion' | 'special' | 'equipment' | 'exchange'>('companion');
  const { toast } = useToast();

  const handleCompanionPull = (isSpecial: boolean = false, count: number = 1) => {
    setCompanionResults([]);
    setEquipmentResults([]);
    setIsAnimating(true);
    
    setTimeout(() => {
      pullCompanion({ isSpecial, count }, {
        onSuccess: (data: any) => {
          setCompanionResults(data.companions);
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

  const handleEquipmentPull = (count: number = 1) => {
    setCompanionResults([]);
    setEquipmentResults([]);
    setIsAnimating(true);
    
    setTimeout(() => {
      pullEquipment({ count }, {
        onSuccess: (data: any) => {
          setEquipmentResults(data.equipment);
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
  const canAffordCompanion10 = (player?.rice || 0) >= companionCost * 10;
  const canAffordSpecial = (player?.rice || 0) >= specialCost;
  const canAffordSpecial10 = (player?.rice || 0) >= specialCost * 10;
  const canAffordEquipment = (player?.rice || 0) >= equipmentCost;
  const canAffordEquipment10 = (player?.rice || 0) >= equipmentCost * 10;

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
        <div className="relative w-full max-w-4xl flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl"></div>
          
          <AnimatePresence mode="wait">
            {companionResults.length === 0 && equipmentResults.length === 0 && !isAnimating && (
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
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      onClick={activeTab === 'companion' ? () => handleCompanionPull(false, 1) : activeTab === 'special' ? () => handleCompanionPull(true, 1) : () => handleEquipmentPull(1)}
                      disabled={
                        activeTab === 'companion' ? (!canAffordCompanion || isPullingCompanion) : 
                        activeTab === 'special' ? (!canAffordSpecial || isPullingCompanion) :
                        (!canAffordEquipment || isPullingEquipment)
                      }
                      className={`bg-gradient-to-r ${activeTab === 'special' ? 'from-amber-600 to-yellow-700 shadow-[0_0_25px_rgba(234,179,8,0.5)]' : 'from-primary to-secondary shadow-[0_0_20px_rgba(220,38,38,0.4)]'} hover:from-primary/90 hover:to-secondary/90 text-white px-8 py-6 rounded-full text-lg font-bold border border-accent/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all group`}
                    >
                      <span className="mr-3">Draw 1</span>
                      <div className="flex items-center text-accent group-hover:text-white transition-colors text-sm bg-black/30 px-2 py-0.5 rounded-full">
                        <Wheat size={14} className="mr-1" /> {activeTab === 'companion' ? companionCost : activeTab === 'special' ? specialCost : equipmentCost}
                      </div>
                    </Button>

                    <Button 
                      onClick={activeTab === 'companion' ? () => handleCompanionPull(false, 10) : activeTab === 'special' ? () => handleCompanionPull(true, 10) : () => handleEquipmentPull(10)}
                      disabled={
                        activeTab === 'companion' ? (!canAffordCompanion10 || isPullingCompanion) : 
                        activeTab === 'special' ? (!canAffordSpecial10 || isPullingCompanion) :
                        (!canAffordEquipment10 || isPullingEquipment)
                      }
                      className={`bg-gradient-to-r ${activeTab === 'special' ? 'from-amber-500 to-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.5)]' : 'from-red-600 to-orange-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]'} hover:from-primary/90 hover:to-secondary/90 text-white px-8 py-6 rounded-full text-lg font-bold border border-accent/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all group`}
                    >
                      <span className="mr-3">Draw 10</span>
                      <div className="flex items-center text-accent group-hover:text-white transition-colors text-sm bg-black/30 px-2 py-0.5 rounded-full">
                        <Wheat size={14} className="mr-1" /> {activeTab === 'companion' ? companionCost * 10 : activeTab === 'special' ? specialCost * 10 : equipmentCost * 10}
                      </div>
                    </Button>
                  </div>
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

            {companionResults.length > 0 && !isAnimating && (
              <motion.div 
                key="companion-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10 w-full mt-8"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  {companionResults.map((companion, i) => (
                    <motion.div 
                      key={i}
                      initial={{ scale: 0.5, opacity: 0, y: 50 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ type: "spring", bounce: 0.5, delay: i * 0.1 }}
                      className="bg-card border-2 border-accent/50 rounded-xl p-4 text-center shadow-lg bg-washi relative"
                    >
                      <h2 className="text-xl font-display font-bold text-white mb-1">{companion.name}</h2>
                      <p className="text-primary font-medium tracking-widest uppercase text-[10px] mb-2">{companion.type}</p>
                      <div className="flex justify-center gap-0.5 text-accent mb-2">
                        {Array.from({ length: Number(companion.rarity) }).map((_, j) => (
                          <Star key={j} size={14} fill="currentColor" />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-left bg-background/50 p-2 rounded border border-border/50">
                        <div><span className="text-muted-foreground uppercase">HP</span><p className="font-bold text-green-400">{companion.hp}</p></div>
                        <div><span className="text-muted-foreground uppercase">ATK</span><p className="font-bold text-red-400">{companion.attack}</p></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Button onClick={() => setCompanionResults([])} variant="outline" className="mt-8 mx-auto block border-accent text-accent hover:bg-accent/10">Draw Again</Button>
              </motion.div>
            )}

            {equipmentResults.length > 0 && !isAnimating && (
              <motion.div 
                key="equipment-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10 w-full mt-8"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  {equipmentResults.map((equipment, i) => (
                    <motion.div 
                      key={i}
                      initial={{ scale: 0.5, opacity: 0, y: 50 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ type: "spring", bounce: 0.5, delay: i * 0.1 }}
                      className="bg-card border-2 border-accent/50 rounded-xl p-4 text-center shadow-lg bg-washi relative"
                    >
                      <h2 className="text-sm font-display font-bold text-white mb-1 line-clamp-1">{equipment.name}</h2>
                      <Badge className={`mb-2 uppercase text-[8px] tracking-tighter ${getRarityColor(equipment.rarity)}`}>
                        {equipment.rarity}
                      </Badge>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-left bg-background/50 p-2 rounded border border-border/50">
                        <div><span className="text-muted-foreground uppercase">ATK</span><p className="font-bold text-red-400">+{equipment.attackBonus}</p></div>
                        <div><span className="text-muted-foreground uppercase">DEF</span><p className="font-bold text-blue-400">+{equipment.defenseBonus}</p></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Button onClick={() => setEquipmentResults([])} variant="outline" className="mt-8 mx-auto block border-accent text-accent hover:bg-accent/10">Draw Again</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
