import { useState, useEffect } from "react";
import { useFieldBattle, useBossBattle, useSpecialBossBattle, BattleResult, useCampaignEvents, useTriggerCampaignEvent, usePlayerFullStatus, useEquipment } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Map as MapIcon, Swords, Skull, ChevronRight, Crown, Zap, Shield, Heart, Sparkles, ArrowUp, Scroll, Star, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const LOCATIONS = [
  // Japan (Region 1)
  { id: 1, name: "Owari Province", desc: "Starting grounds of the Oda clan. Bandits and minor yokai roam here.", level: 1, region: "Japan" },
  { id: 2, name: "Mino Province", desc: "Mountainous terrain hiding fierce warrior monks and elite guards.", level: 10, region: "Japan" },
  { id: 3, name: "Kyoto Approaches", desc: "The capital's outskirts. Heavily defended by the Shogun's remnants.", level: 25, region: "Japan" },
  { id: 4, name: "Edo Outskirts", desc: "The path to the new capital. Protected by elite samurai and treacherous traps.", level: 45, region: "Japan" },
  { id: 5, name: "Mount Fuji Pass", desc: "High altitude slopes where ancient spirits and frozen horrors await.", level: 70, region: "Japan" },
  { id: 6, name: "Demon Gate (鬼門)", desc: "A cursed portal where legendary yokai lurk. Special bosses drop transformation stones.", level: 100, region: "Japan" },
  
  // China (Region 2)
  { id: 101, name: "Great Wall Pass", desc: "The legendary fortification. Guarded by ancient terracotta constructs and northern nomads.", level: 130, region: "China" },
  { id: 102, name: "Yellow River Valley", desc: "The cradle of civilization. Water spirits and imperial deserters haunt these fertile lands.", level: 170, region: "China" },
  { id: 103, name: "Forbidden City Gates", desc: "The entrance to the imperial heart. Elite palace guards and court sorcerers defend the perimeter.", level: 220, region: "China" },
  { id: 104, name: "Kunlun Mountains", desc: "The dwelling of immortals. Mythical beasts and powerful cultivators test your resolve.", level: 280, region: "China" },
];

const STORY_EVENTS = [
  {
    key: 'onin_war',
    name: 'The Onin War',
    desc: 'The capital is in chaos. Which faction will you support to restore order?',
    choices: [
      { key: 'nobunaga', label: 'Support Oda', color: 'bg-red-900/50 hover:bg-red-900/70 border-red-700/50' },
      { key: 'independent', label: 'Stay Independent', color: 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600' }
    ]
  },
  {
    key: 'honnoji',
    name: 'Incident at Honno-ji',
    desc: 'The temple is surrounded by Akechi forces! What is your move?',
    choices: [
      { key: 'rescue', label: 'Rescue the Lord', color: 'bg-orange-900/50 hover:bg-orange-900/70 border-orange-700/50' },
      { key: 'mitsuhide', label: 'Join Mitsuhide', color: 'bg-blue-900/50 hover:bg-blue-900/70 border-blue-700/50' }
    ]
  },
  {
    key: 'yokai_random',
    name: 'Encounter with the Divine',
    desc: 'A golden fox blocks your path, offering a pack of shadows.',
    choices: [
      { key: 'ally', label: 'Form Alliance', color: 'bg-yellow-900/50 hover:bg-yellow-900/70 border-yellow-700/50' },
      { key: 'ignore', label: 'Decline Offer', color: 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600' }
    ]
  }
];

export default function MapPage() {
  const { mutate: doFieldBattle, isPending: fieldPending } = useFieldBattle();
  const { mutate: doBossBattle, isPending: bossPending } = useBossBattle();
  const { mutate: doSpecialBoss, isPending: specialPending } = useSpecialBossBattle();
  const { data: events } = useCampaignEvents();
  const { mutate: triggerEvent, isPending: eventPending } = useTriggerCampaignEvent();

  const [result, setResult] = useState<BattleResult | null>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [preBattleInfo, setPreBattleInfo] = useState<{ type: 'field' | 'boss' | 'special', locationId: number, enemy: any, repeatCount: number } | null>(null);
  const [ninjaEncounter, setNinjaEncounter] = useState<any>(null);
  const [isResolvingNinja, setIsResolvingNinja] = useState(false);

  const { data: playerStatus } = usePlayerFullStatus();
  const { data: equipment } = useEquipment();
  const { toast } = useToast();

  const handleEquip = async (id: number) => {
    try {
      await apiRequest('POST', `/api/equipment/${id}/equip`, { equippedToId: null, equippedToType: 'player' });
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      toast({ title: "Equipped", description: "Item equipped successfully." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to equip item." });
    }
  };

  const handleUnequip = async (id: number) => {
    try {
      await apiRequest('POST', `/api/equipment/${id}/unequip`);
      queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
      queryClient.invalidateQueries({ queryKey: [api.equipment.list.path] });
      toast({ title: "Unequipped", description: "Item unequipped successfully." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to unequip item." });
    }
  };

  useEffect(() => {
    // Random IF trigger check
    // Reduced chance from 0.05 to 0.02
    if (!activeEvent && Math.random() < 0.01) {
       const isDone = events?.some(e => e.eventKey === 'yokai_random');
       if (!isDone) setActiveEvent(STORY_EVENTS[2]);
    }
  }, [events]);

  const initiateBattle = (type: 'field' | 'boss' | 'special', locationId: number) => {
    // Generate a preview of the enemy based on location and type
    const loc = LOCATIONS.find(l => l.id === locationId);
    
    let targetLevel = 1;
    if (locationId >= 100) {
      targetLevel = 7 + (locationId - 101);
    } else {
      targetLevel = locationId;
    }

    const locationMultiplier = 1 + (targetLevel - 1) * 0.1;
    
    const commonFieldEnemies = locationId >= 100 ? ["Terracotta Guard", "Silk Road Bandit", "Mountain Cultivator"] : ["Oni Brute", "Kappa Scout", "Tengu Warrior", "Kitsune Trickster", "Jorogumo"];
    
    let enemyPreview: any;
    if (type === 'field') {
      const lvl = targetLevel;
      const baseHp = lvl * 40 + 100;
      const baseAtk = lvl * 10 + 20;
      const baseDef = lvl * 6 + 15;
      const baseSpd = lvl * 5 + 10;

      enemyPreview = {
        name: commonFieldEnemies[0],
        level: lvl,
        hp: Math.floor(baseHp * locationMultiplier),
        attack: Math.floor(baseAtk * locationMultiplier),
        defense: Math.floor(baseDef * locationMultiplier),
        speed: Math.floor(baseSpd * locationMultiplier),
      };
    } else if (type === 'boss') {
      const lvl = targetLevel + 2;
      const name = locationId >= 100 ? "General Lu Bu" : "Daimyo Takeda Shingen";

      enemyPreview = {
        name: name,
        level: lvl,
        hp: Math.floor((lvl * 200 + 1000) * locationMultiplier),
        attack: Math.floor((lvl * 30 + 100) * locationMultiplier),
        defense: Math.floor((lvl * 25 + 80) * locationMultiplier),
        speed: Math.floor((lvl * 15 + 50) * locationMultiplier),
      };
    } else {
      const lvl = targetLevel + 5;
      const name = locationId >= 100 ? "Celestial Dragon Emperor" : "Nine-Tailed Fox (九尾の狐)";
      
      enemyPreview = {
        name: name,
        level: lvl,
        hp: Math.floor((lvl * 400 + 5000) * locationMultiplier),
        attack: Math.floor((lvl * 60 + 300) * locationMultiplier),
        defense: Math.floor((lvl * 50 + 250) * locationMultiplier),
        speed: Math.floor((lvl * 30 + 100) * locationMultiplier),
      };
    }
    
    setPreBattleInfo({ type, locationId, enemy: enemyPreview, repeatCount: 1 });
  };

  const handleBattle = () => {
    if (!preBattleInfo) return;
    const { type, locationId, repeatCount } = preBattleInfo;
    
    // Convert to numbers explicitly
    const locIdNum = Number(locationId);
    const repeatNum = Number(repeatCount);
    
    const action = type === 'field' ? doFieldBattle : type === 'boss' ? doBossBattle : doSpecialBoss;
    
    const params = type === 'field' 
      ? { locationId: locIdNum, repeatCount: repeatNum, enemyName: preBattleInfo.enemy.name } 
      : { locationId: locIdNum, enemyName: preBattleInfo.enemy.name };
    
    action(params as any, {
      onSuccess: (data: any) => {
        if (data.ninjaEncounter) {
          setNinjaEncounter(data.ninjaEncounter);
          return;
        }
        setResult(data);
        setPreBattleInfo(null);
        if (data.victory) {
          if (locIdNum === 1 && !events?.some(e => e.eventKey === 'onin_war')) {
            setActiveEvent(STORY_EVENTS[0]);
          } else if (locIdNum === 3 && !events?.some(e => e.eventKey === 'honnoji')) {
            setActiveEvent(STORY_EVENTS[1]);
          }
        }
      },
      onError: (err: any) => {
        console.error("Battle error:", err);
        setPreBattleInfo(null);
      }
    });
  };

  const handleEventChoice = (eventKey: string, choice: string) => {
    triggerEvent({ eventKey, choice }, {
      onSuccess: (data) => {
        setEventLogs(data.logs);
      }
    });
  };

  const handleResolveNinja = (action: 'pay' | 'fight') => {
    setIsResolvingNinja(true);
    apiRequest('POST', '/api/battle/ninja/resolve', {
      action,
      ninjaName: ninjaEncounter.name,
      goldDemanded: Math.floor(Number(ninjaEncounter.goldDemanded))
    }).then(async (res) => {
      const data = await res.json();
      if (res.ok) {
        if (action === 'pay') {
          setEventLogs([data.message]);
          setNinjaEncounter(null);
          await queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
          await queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
        } else {
          setResult(data.battleResult);
          setNinjaEncounter(null);
          await queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
          await queryClient.invalidateQueries({ queryKey: [api.player.fullStatus.path] });
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Something went wrong",
          variant: "destructive"
        });
      }
    }).finally(() => {
      setIsResolvingNinja(false);
    });
  };

  const isPending = fieldPending || bossPending || specialPending || eventPending;

  const [selectedRegion, setSelectedRegion] = useState<string>("Japan");
  const filteredLocations = LOCATIONS.filter(l => l.region === selectedRegion);

  return (
    <MainLayout>
      <div className={`space-y-6 max-w-5xl mx-auto p-6 rounded-xl transition-colors duration-500 ${selectedRegion === 'China' ? 'bg-blue-950/10' : 'bg-red-950/5'}`}>
        <div className="border-b border-border/50 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MapIcon className="text-accent" size={32} />
            <div>
              <h1 className="text-3xl font-display font-bold text-white" data-testid="text-page-title">Campaign Map</h1>
              <p className="text-muted-foreground">Journey through the Orient. Historical events will shape your destiny.</p>
            </div>
          </div>
          
          <div className="flex gap-2 bg-card/50 p-1 rounded-lg border border-border/30">
            {["Japan", "China"].map(region => (
              <Button
                key={region}
                variant={selectedRegion === region ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedRegion(region)}
                className={selectedRegion === region ? "bg-primary text-black" : "text-muted-foreground"}
              >
                {region}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4 mt-8">
          {filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className={`bg-card border rounded-lg p-1 flex flex-col md:flex-row bg-washi hover:border-border transition-colors ${loc.id === 6 || loc.id === 104 ? 'border-purple-700/50 shadow-[0_0_20px_rgba(128,0,255,0.1)]' : 'border-border/50'}`}
            >
              <div
                className="h-32 md:h-auto md:w-48 bg-cover bg-center rounded-md m-1 opacity-80"
                style={{ backgroundImage: `url(${loc.region === 'China' ? 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=800&auto=format&fit=crop' : 'https://images.unsplash.com/photo-1578469645742-46cae010e5d4?q=80&w=800&auto=format&fit=crop'})` }}
              />

              <div className="p-4 flex-1 flex flex-col justify-between relative z-10">
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] -z-10 rounded-lg" />
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-display font-bold text-white">{loc.name}</h2>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-bold">Rec. Lv {loc.level}</span>
                    {(loc.id === 6 || loc.id === 104) && <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded font-bold border border-purple-700/30">Special</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">{loc.desc}</p>
                </div>

                <div className="flex flex-wrap gap-3 mt-auto">
                  <Button
                    onClick={() => initiateBattle('field', loc.id)}
                    disabled={isPending}
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10 text-zinc-200"
                    data-testid={`battle-field-${loc.id}`}
                  >
                    <Swords size={16} className="mr-2 text-primary" />
                    Field Skirmish
                  </Button>
                  <Button
                    onClick={() => initiateBattle('boss', loc.id)}
                    disabled={isPending}
                    className="bg-secondary hover:bg-secondary/80 text-white"
                    data-testid={`battle-boss-${loc.id}`}
                  >
                    <Skull size={16} className="mr-2 text-accent" />
                    Assault {loc.region === 'China' ? 'Stronghold' : 'Castle'}
                  </Button>
                  {(loc.id === 6 || loc.id === 104) && (
                    <Button
                      onClick={() => initiateBattle('special', loc.id)}
                      disabled={isPending}
                      className="bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 border border-purple-700/40 shadow-[0_0_12px_rgba(128,0,255,0.2)]"
                      data-testid={`battle-special-${loc.id}`}
                    >
                      <Crown size={16} className="mr-2 text-purple-400" />
                      Challenge {loc.region === 'China' ? 'Celestial Guardian' : 'Demon Lord'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={preBattleInfo !== null} onOpenChange={(open) => !open && setPreBattleInfo(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="font-display text-xl text-center text-white">Battle Preparation</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3">
            <div className="space-y-3">
              {/* Attacker Side */}
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Your Team</h4>
                  <span className="text-[9px] text-zinc-500 italic">Slide to switch</span>
                </div>
                <Carousel className="w-full">
                  <CarouselContent>
                    {/* Main Player */}
                    <CarouselItem>
                      <div className="bg-blue-950/20 p-2 rounded border border-blue-900/30">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-white text-xs truncate">{(playerStatus?.player as any)?.firstName || 'Warrior'} (You)</p>
                          <span className="text-[9px] text-zinc-400 font-mono">Lv {playerStatus?.player?.level}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 mb-2">
                          <div className="bg-background/40 p-1 rounded text-center">
                            <span className="text-zinc-500 text-[8px] block uppercase">HP</span>
                            <span className="text-red-400 font-mono text-xs leading-none">{playerStatus?.player?.hp}</span>
                          </div>
                          <div className="bg-background/40 p-1 rounded text-center">
                            <span className="text-zinc-500 text-[8px] block uppercase">ATK</span>
                            <span className="text-orange-400 font-mono text-xs leading-none">{playerStatus?.player?.attack}</span>
                          </div>
                          <div className="bg-background/40 p-1 rounded text-center">
                            <span className="text-zinc-500 text-[8px] block uppercase">DEF</span>
                            <span className="text-blue-400 font-mono text-xs leading-none">{playerStatus?.player?.defense}</span>
                          </div>
                          <div className="bg-background/40 p-1 rounded text-center">
                            <span className="text-zinc-500 text-[8px] block uppercase">SPD</span>
                            <span className="text-cyan-400 font-mono text-xs leading-none">{playerStatus?.player?.speed}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-t border-blue-900/20 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">HIT</span>
                            <span className="text-primary font-bold text-xs">
                              {(() => {
                                const level = playerStatus?.player?.level || 1;
                                const dex = (playerStatus?.player as any)?.dex || 10;
                                const hit = 100 + (level * 2) + (dex * 1.5);
                                
                                const eLevel = preBattleInfo?.enemy?.level || 1;
                                const flee = eLevel * 3;
                                
                                const dodge = Math.max(5, Math.min(95, 100 - (hit + 80 - flee)));
                                return `${100 - dodge}%`;
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">DODGE</span>
                            <span className="text-amber-500 font-bold text-xs">
                              {(() => {
                                const eLevel = preBattleInfo?.enemy?.level || 1;
                                const hit = eLevel * 3;
                                
                                const level = playerStatus?.player?.level || 1;
                                const agi = (playerStatus?.player as any)?.agi || 10;
                                const flee = 100 + (level * 1) + (agi * 1.5);
                                
                                const dodge = Math.max(5, Math.min(95, 100 - (hit + 80 - flee)));
                                return `${dodge}%`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>

                    {/* Companions */}
                    {playerStatus?.companions?.map((companion, index) => (
                      <CarouselItem key={companion.id || index}>
                        <div className="bg-blue-950/20 p-2 rounded border border-blue-900/30">
                          <div className="flex justify-between items-center mb-1">
                            <p className="font-bold text-white text-xs truncate">{companion.name}</p>
                            <span className="text-[9px] text-zinc-400 font-mono">Lv {companion.level}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 mb-2">
                            <div className="bg-background/40 p-1 rounded text-center">
                              <span className="text-zinc-500 text-[8px] block uppercase">HP</span>
                              <span className="text-red-400 font-mono text-xs leading-none">{companion.hp}</span>
                            </div>
                            <div className="bg-background/40 p-1 rounded text-center">
                              <span className="text-zinc-500 text-[8px] block uppercase">ATK</span>
                              <span className="text-orange-400 font-mono text-xs leading-none">{companion.attack}</span>
                            </div>
                            <div className="bg-background/40 p-1 rounded text-center">
                              <span className="text-zinc-500 text-[8px] block uppercase">DEF</span>
                              <span className="text-blue-400 font-mono text-xs leading-none">{companion.defense}</span>
                            </div>
                            <div className="bg-background/40 p-1 rounded text-center">
                              <span className="text-zinc-500 text-[8px] block uppercase">SPD</span>
                              <span className="text-cyan-400 font-mono text-xs leading-none">{companion.speed}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center border-t border-blue-900/20 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-zinc-500 font-bold uppercase">HIT</span>
                              <span className="text-primary font-bold text-xs">
                                {(() => {
                                  const level = companion.level || 1;
                                  const dex = (companion as any).dex || 10;
                                  const hit = 100 + (level * 2) + (dex * 1.5);
                                  
                                  const eLevel = preBattleInfo?.enemy?.level || 1;
                                  const flee = eLevel * 3;
                                  
                                  const dodge = Math.max(5, Math.min(95, 100 - (hit + 80 - flee)));
                                  return `${100 - dodge}%`;
                                })()}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-zinc-500 font-bold uppercase">DODGE</span>
                              <span className="text-amber-500 font-bold text-xs">
                                {(() => {
                                  const eLevel = preBattleInfo?.enemy?.level || 1;
                                  const hit = eLevel * 3;
                                  
                                  const level = companion.level || 1;
                                  const agi = (companion as any).agi || 10;
                                  const flee = 100 + (level * 1) + (agi * 1.5);
                                  
                                  const dodge = Math.max(5, Math.min(95, 100 - (hit + 80 - flee)));
                                  return `${dodge}%`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {playerStatus?.companions && playerStatus.companions.length > 0 && (
                    <>
                      <CarouselPrevious className="left-1 h-5 w-5 bg-background/50 border-none hover:bg-background/80" />
                      <CarouselNext className="right-1 h-5 w-5 bg-background/50 border-none hover:bg-background/80" />
                    </>
                  )}
                </Carousel>
              </div>

              {/* VS Divider */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/20"></div></div>
                <span className="relative px-2 bg-card text-[9px] font-bold text-zinc-600 uppercase italic">VS</span>
              </div>

              {/* Defender Side */}
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest px-1 text-right">Enemy</h4>
                <div className="bg-red-950/20 p-2 rounded border border-red-900/30">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-white text-xs truncate">{preBattleInfo?.enemy.name}</p>
                    <span className="text-[9px] text-zinc-400 font-mono">Lv {preBattleInfo?.enemy.level}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <div className="bg-background/40 p-1 rounded text-center">
                      <span className="text-zinc-500 text-[8px] block uppercase">HP</span>
                      <span className="text-red-400 font-mono text-xs leading-none">{preBattleInfo?.enemy.hp}</span>
                    </div>
                    <div className="bg-background/40 p-1 rounded text-center">
                      <span className="text-zinc-500 text-[8px] block uppercase">ATK</span>
                      <span className="text-orange-400 font-mono text-xs leading-none">{preBattleInfo?.enemy.attack}</span>
                    </div>
                    <div className="bg-background/40 p-1 rounded text-center">
                      <span className="text-zinc-500 text-[8px] block uppercase">DEF</span>
                      <span className="text-blue-400 font-mono text-xs leading-none">{preBattleInfo?.enemy.defense}</span>
                    </div>
                    <div className="bg-background/40 p-1 rounded text-center">
                      <span className="text-zinc-500 text-[8px] block uppercase">SPD</span>
                      <span className="text-cyan-400 font-mono text-xs leading-none">{preBattleInfo?.enemy.speed}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-red-900/20 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">HIT</span>
                      <span className="text-red-500 font-bold text-xs">
                        {(() => {
                          const eLevel = preBattleInfo?.enemy?.level || 1;
                          const hit = eLevel * 3;
                          
                          const pLevel = playerStatus?.player?.level || 1;
                          const agi = (playerStatus?.player as any)?.agi || 10;
                          const flee = 100 + (pLevel * 1) + (agi * 1.5);
                          
                          const dodge = Math.max(5, Math.min(95, 100 - (hit + 80 - flee)));
                          return `${100 - dodge}%`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">DODGE</span>
                      <span className="text-amber-500 font-bold text-xs">
                        {(() => {
                          const pLevel = playerStatus?.player?.level || 1;
                          const dex = (playerStatus?.player as any)?.dex || 10;
                          const hit = 100 + (pLevel * 2) + (dex * 1.5);
                          
                          const eLevel = preBattleInfo?.enemy?.level || 1;
                          const flee = eLevel * 3;
                          
                          const dodge = Math.max(5, Math.min(95, 100 - (hit + 80 - flee)));
                          return `${dodge}%`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {preBattleInfo?.type === 'field' && (
              <div className="pt-2 border-t border-border/20 px-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-white uppercase">Repeat X{preBattleInfo.repeatCount}</span>
                </div>
                <Slider
                  defaultValue={[1]}
                  max={10}
                  min={1}
                  step={1}
                  onValueChange={(val) => setPreBattleInfo({ ...preBattleInfo, repeatCount: val[0] })}
                  className="py-2"
                />
              </div>
            )}
            
            <DialogFooter className="p-4 pt-2 gap-2 sm:gap-0 flex-row">
              <Button variant="ghost" onClick={() => setPreBattleInfo(null)} className="flex-1 h-9 text-xs">Withdraw</Button>
              <Button onClick={handleBattle} className="flex-1 h-9 bg-primary hover:bg-primary/80 text-black font-bold text-xs">Charge!</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ninjaEncounter !== null} onOpenChange={(open) => !open && !isResolvingNinja && setNinjaEncounter(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-center text-amber-500">Famous Ninja Encounter!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-950/20 p-4 rounded border border-amber-900/30 text-center">
              <Skull className="mx-auto mb-2 text-amber-500" size={48} />
              <h3 className="text-xl font-bold text-white mb-2">{ninjaEncounter?.name}</h3>
              <p className="text-sm text-zinc-300">
                The legendary shinobi blocks your path. "Your gold or your life, warrior."
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Demand:</span>
                <span className="text-amber-400 font-bold">{ninjaEncounter?.goldDemanded} Gold (10%)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Ninja Level:</span>
                <span className="text-red-400 font-bold">{ninjaEncounter?.level}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => handleResolveNinja('pay')} 
              disabled={isResolvingNinja || ((playerStatus?.gold || 0) < (ninjaEncounter?.goldDemanded || 0) && (playerStatus?.gold || 0) > 0)}
              className="flex-1 border-amber-700/50 hover:bg-amber-900/20"
            >
              Pay {Math.floor(ninjaEncounter?.goldDemanded || 0)} Gold
            </Button>
            <Button 
              onClick={() => handleResolveNinja('fight')} 
              disabled={isResolvingNinja}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold"
            >
              Fight!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <span className="text-zinc-500">Lv {e.level}</span>
                    <span className="text-red-400 font-mono">HP: {e.hp}/{e.maxHp}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider px-1">Battle Records</h4>
              <div className="bg-zinc-950/40 border border-border/30 rounded p-3 font-mono text-xs space-y-1 h-48 overflow-y-auto custom-scrollbar">
                {result?.logs.map((log, i) => (
                  <div key={i} className={log.includes('MISS') ? 'text-zinc-500' : log.includes('CRITICAL') ? 'text-accent font-bold' : 'text-zinc-300'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {result?.victory && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent/10 border border-accent/20 rounded p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="text-accent" size={18} />
                    <span className="text-sm font-bold text-white">Experience</span>
                  </div>
                  <span className="text-accent font-bold">+{result.experienceGained}</span>
                </div>
                <div className="bg-amber-900/10 border border-amber-900/20 rounded p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="text-amber-500" size={18} />
                    <span className="text-sm font-bold text-white">Gold Gained</span>
                  </div>
                  <span className="text-amber-500 font-bold">+{result.goldGained}</span>
                </div>
              </div>
            )}

            <AnimatePresence>
              {(result?.equipmentDropped?.length || 0) > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-purple-900/10 border border-purple-700/30 rounded-lg p-4"
                >
                  <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Package size={16} />
                    Loot Acquired
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {result?.equipmentDropped?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-purple-950/20 p-2 rounded border border-purple-700/20">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${
                            item.rarity === 'Legendary' ? 'text-orange-400' : 
                            item.rarity === 'Epic' ? 'text-purple-400' : 
                            item.rarity === 'Rare' ? 'text-blue-400' : 'text-zinc-300'
                          }`}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">{item.rarity} {item.type}</span>
                        </div>
                        <div className="flex gap-2">
                          {!item.isEquipped && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] bg-purple-900/20 border-purple-700/30"
                              onClick={() => handleEquip(item.id)}
                            >
                              Equip
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="p-4 border-t border-border/50">
            <Button onClick={() => setResult(null)} className="w-full bg-accent hover:bg-accent/80 text-black font-bold">
              Return to Map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeEvent !== null} onOpenChange={(open) => {
        if (!open && !eventPending) {
          setActiveEvent(null);
          setEventLogs([]);
        }
      }}>
        <DialogContent className="bg-card border-accent/30 text-foreground sm:max-w-xl bg-shoji">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-white">
              {activeEvent?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {eventLogs.length === 0 ? (
              <>
                <p className="text-zinc-300 leading-relaxed italic text-lg border-l-4 border-accent pl-4">
                  "{activeEvent?.desc}"
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {activeEvent?.choices.map((choice: any) => (
                    <Button
                      key={choice.key}
                      onClick={() => handleEventChoice(activeEvent.key, choice.key)}
                      disabled={eventPending}
                      className={`${choice.color} border py-6 h-auto flex flex-col items-center justify-center gap-1`}
                    >
                      <span className="font-bold text-lg">{choice.label}</span>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800">
                  {eventLogs.map((log, i) => (
                    <p key={i} className="text-zinc-300 mb-2 last:mb-0 leading-relaxed">
                      {log}
                    </p>
                  ))}
                </div>
                <Button 
                  onClick={() => {
                    setActiveEvent(null);
                    setEventLogs([]);
                  }}
                  className="w-full bg-accent text-black font-bold"
                >
                  Continue Journey
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
