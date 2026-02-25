import { useState } from "react";
import { useEquipment, useEquip, useUnequip, useCompanions, usePlayer, useRecycleEquipment, useUpgradeEquipment, useEndowEquipment } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sword, Shield, Crosshair, Zap, Sparkles, ArrowUp, Trash2, Hammer, Gem } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EquipmentPage() {
  const { toast } = useToast();
  const { data: player } = usePlayer();
  const { data: equipment, isLoading: eqLoading } = useEquipment();
  const { data: companions } = useCompanions();
  const { mutate: equipItem, isPending } = useEquip();
  const { mutate: unequipItem, isPending: unequipPending } = useUnequip();
  const { mutate: recycleItem, isPending: recyclePending } = useRecycleEquipment();
  const { mutate: upgradeItem, isPending: upgradePending } = useUpgradeEquipment();
  const { mutate: endowItem, isPending: endowPending } = useEndowEquipment();

  const [selectedEqId, setSelectedEqId] = useState<number | null>(null);
  const [endowDialogOpen, setEndowDialogOpen] = useState(false);
  const [useProtection, setUseProtection] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const { mutate: recycleRarity, isPending: recycleRarityPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/equipment/recycle-rarity", {});
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player"] });
    },
  });

  const handleEquip = (targetId: number | null, targetType: string) => {
    if (selectedEqId) {
      equipItem({ equipmentId: selectedEqId, equippedToId: targetId, equippedToType: targetType });
      setSelectedEqId(null);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'white': return 'text-zinc-400 border-zinc-700 bg-zinc-900/50';
      case 'green': return 'text-green-400 border-green-900 bg-green-900/10';
      case 'blue': return 'text-blue-400 border-blue-900 bg-blue-900/10';
      case 'purple': return 'text-purple-400 border-purple-900 bg-purple-900/10';
      case 'gold': return 'text-yellow-400 border-yellow-700 bg-yellow-900/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]';
      case 'mythic': return 'text-pink-400 border-pink-900 bg-pink-900/10 shadow-[0_0_20px_rgba(236,72,153,0.3)]';
      case 'exotic': return 'text-teal-400 border-teal-900 bg-teal-900/10 shadow-[0_0_25px_rgba(20,184,166,0.4)]';
      case 'transcendent': return 'text-zinc-100 border-white/20 bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-pulse';
      case 'celestial': return 'text-cyan-400 border-cyan-700 bg-cyan-950/20 shadow-[0_0_40px_rgba(34,211,238,0.5)] font-bold';
      case 'primal': return 'text-red-600 border-red-900 bg-black shadow-[0_0_50px_rgba(220,38,38,0.6)] font-black uppercase tracking-tighter';
      default: return 'text-white border-border bg-card';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'weapon': return Sword;
      case 'shield': return Shield;
      case 'armor': return Shield;
      case 'garment': return Zap;
      case 'footgear': return Zap;
      case 'accessory': return Sparkles;
      case 'headgearUpper': return Sparkles;
      case 'headgearMiddle': return Sparkles;
      case 'headgearLower': return Sparkles;
      default: return Sword;
    }
  };

  const getEquippedName = (eq: any) => {
    if (!eq.isEquipped) return null;
    if (eq.equippedToType === 'player') return "Main Character";
    const comp = companions?.find(c => c.id === eq.equippedToId);
    return comp ? comp.name : "Unknown";
  };

  const typeLabel = (type: string) => type === 'horse_gear' ? 'Horse Gear' : type.charAt(0).toUpperCase() + type.slice(1);

  const typeFiltered = filterType === 'all' ? equipment : equipment?.filter(e => e.type === filterType);
  const sortedEquipment = typeFiltered ? [...typeFiltered].sort((a, b) => {
    if (a.isEquipped !== b.isEquipped) return a.isEquipped ? -1 : 1;
    return a.id - b.id;
  }) : [];

  if (eqLoading) return <MainLayout><div className="p-8">Opening armory...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        {recycleRarityPending && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border border-border p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-xl font-display font-bold text-white">Recycling Equipment</h3>
                <p className="text-muted-foreground text-sm">Purifying items into Upgrade Stones...</p>
              </div>
            </div>
          </div>
        )}
        <div className="border-b border-border/50 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">Armory</h1>
            <p className="text-muted-foreground">Manage weapons, armor, and gear. Only one item per type can be equipped.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-purple-900/20 border border-purple-700/30 px-4 py-2 rounded-lg">
              <Gem size={18} className="text-purple-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">Upgrade Stones</span>
                <span className="text-lg font-bold text-white leading-none">{player?.upgradeStones || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 px-4 py-2 rounded-lg">
              <Sparkles size={18} className="text-amber-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-300 uppercase font-bold tracking-wider">Endowment Stones</span>
                <span className="text-lg font-bold text-white leading-none">{player?.endowmentStones || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/30 px-4 py-2 rounded-lg" title="Fire God Talisman">
              <Zap size={18} className="text-red-400" />
              <span className="text-lg font-bold text-white leading-none">{player?.fireGodTalisman || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'weapon', 'shield', 'armor', 'garment', 'footgear', 'accessory', 'headgearUpper', 'headgearMiddle', 'headgearLower'].map(t => (
              <Button
                key={t}
                size="sm"
                variant={filterType === t ? "default" : "outline"}
                onClick={() => setFilterType(t)}
                data-testid={`filter-type-${t}`}
              >
                {t === 'all' ? 'All Types' : typeLabel(t)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-[10px] ml-auto gap-2"
              onClick={() => {
                if (confirm(`Recycle all un-equipped items?`)) {
                  recycleRarity();
                }
              }}
              disabled={recycleRarityPending}
              data-testid="button-recycle-all"
            >
              <Trash2 size={12} />
              Recycle All Un-equipped
            </Button>
          </div>
        </div>

        {sortedEquipment.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <Sword className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">Armory Empty</h3>
            <p className="text-muted-foreground">Defeat enemies in the field to loot equipment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedEquipment.map((item) => {
              const TypeIcon = getTypeIcon(item.type);
              const equippedTo = getEquippedName(item);
              return (
                <div
                  key={item.id}
                  className={`relative p-5 rounded-lg border flex flex-col text-zinc-400 border-zinc-700 bg-zinc-900/50 transition-transform hover:-translate-y-1`}
                  data-testid={`equipment-card-${item.id}`}
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TypeIcon size={16} className="shrink-0" />
                      <h3 className="font-bold text-lg font-display truncate leading-tight">
                        {item.name}{item.endowmentPoints > 0 ? ` +${item.endowmentPoints}` : ''}
                      </h3>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <div className="uppercase text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-black/40 border border-white/10">
                        {typeLabel(item.type)}
                      </div>
                      {item.weaponType && (
                        <div className="text-[9px] text-zinc-500 font-mono uppercase">
                          {item.weaponType}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mb-2 text-sm font-medium flex-wrap">
                    {item.attackBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Sword size={14} className="text-red-400" />
                        <span>+{item.attackBonus} ATK</span>
                      </div>
                    )}
                    {item.matkBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Sparkles size={14} className="text-purple-400" />
                        <span>+{item.matkBonus} MATK</span>
                      </div>
                    )}
                    {item.defenseBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Shield size={14} className="text-blue-400" />
                        <span>+{item.defenseBonus} DEF</span>
                      </div>
                    )}
                    {item.mdefBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Shield size={14} className="text-cyan-400" />
                        <span>+{item.mdefBonus} MDEF</span>
                      </div>
                    )}
                    {item.speedBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap size={14} className="text-cyan-400" />
                        <span>+{item.speedBonus} SPD</span>
                      </div>
                    )}
                    {item.hpBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Heart size={14} className="text-red-500" />
                        <span>+{item.hpBonus} HP</span>
                      </div>
                    )}
                    {item.fleeBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap size={14} className="text-green-400" />
                        <span>+{item.fleeBonus} FLEE</span>
                      </div>
                    )}
                    {item.critChance > 0 && (
                      <div className="flex items-center gap-1" title="Critical Chance">
                        <Sparkles size={14} className="text-yellow-400" />
                        <span>{item.critChance}% Crit</span>
                      </div>
                    )}
                    {item.critDamage > 0 && (
                      <div className="flex items-center gap-1" title="Critical Damage">
                        <Sword size={14} className="text-orange-400" />
                        <span>+{item.critDamage}% CDmg</span>
                      </div>
                    )}
                    {item.endowmentPoints > 0 && (
                      <div className="flex items-center gap-1">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>+{item.endowmentPoints} (+{((item.endowmentPoints * 0.5)).toFixed(1)}% DR)</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <div className="flex items-center gap-1">
                        <ArrowUp size={12} />
                        <span>Lv {item.level} / 20</span>
                      </div>
                      <span>{item.experience}/{item.expToNext} EXP</span>
                    </div>
                    <Progress value={(item.experience / item.expToNext) * 100} className="h-1.5" />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      +2% ATK / +3% DEF / +5% SPD per level
                    </p>
                  </div>

                  <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    {equippedTo ? (
                      <span className="text-xs text-accent truncate">Eq: {equippedTo}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">In Inventory</span>
                    )}
                    <div className="flex gap-1">
                      {!item.isEquipped && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-900/30 text-red-400 h-7 text-xs px-2 hover:bg-red-900/20"
                          onClick={() => recycleItem(item.id)}
                          disabled={recyclePending}
                          title="Recycle for stones"
                          data-testid={`recycle-${item.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-900/30 text-amber-400 h-7 text-xs px-2 hover:bg-amber-900/20"
                        onClick={() => {
                          setSelectedEqId(item.id);
                          setEndowDialogOpen(true);
                        }}
                        disabled={endowPending}
                        title="Endow Equipment"
                        data-testid={`endow-${item.id}`}
                      >
                        <Sparkles size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-purple-900/30 text-purple-400 h-7 text-xs px-2 hover:bg-purple-900/20"
                        onClick={() => {
                          const MAX_LEVEL = 20;
                          if (item.level >= MAX_LEVEL) {
                            toast({
                              title: "Max Level Reached",
                              description: "This item is already at the maximum level (20).",
                              variant: "destructive",
                            });
                            return;
                          }
                          const amount = prompt(`How many stones to use? (Max Level: ${MAX_LEVEL})`, "1");
                          if (amount) {
                            const n = parseInt(amount);
                            if (!isNaN(n) && n > 0) {
                              upgradeItem({ id: item.id, amount: n });
                            }
                          }
                        }}
                        disabled={upgradePending || (player?.upgradeStones || 0) < 1}
                        title="Upgrade with stone"
                        data-testid={`upgrade-${item.id}`}
                      >
                        <Hammer size={14} />
                      </Button>
                      {item.isEquipped && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive h-7 text-xs px-2"
                          onClick={() => unequipItem(item.id)}
                          disabled={unequipPending}
                          data-testid={`unequip-${item.id}`}
                        >
                          Remove
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 h-7 text-xs px-2"
                        onClick={() => setSelectedEqId(item.id)}
                        data-testid={`equip-${item.id}`}
                      >
                        Equip
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={endowDialogOpen} onOpenChange={setEndowDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Equipment Endowment</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-amber-900/10 border border-amber-900/30 rounded-lg">
              <h4 className="text-amber-400 font-bold mb-1">Success Rate: {Math.max(10, 90 - ((equipment?.find(e => e.id === selectedEqId)?.endowmentPoints || 0) * 2))}%</h4>
              <p className="text-xs text-muted-foreground mb-1">Current Points: {equipment?.find(e => e.id === selectedEqId)?.endowmentPoints || 0} / 70</p>
              <p className="text-[10px] text-amber-200/50 mb-2 italic">Each point provides 0.5% Damage Reduction (Max 35% total reduction)</p>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="protect" 
                  checked={useProtection} 
                  onChange={(e) => setUseProtection(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="protect" className="text-sm text-zinc-300">Use Protection Talisman (Prevents point loss on failure)</label>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                onClick={() => selectedEqId && endowItem({ id: selectedEqId, type: 'normal', protect: useProtection })}
                disabled={endowPending || (player?.endowmentStones || 0) < 1}
                className="bg-amber-700 hover:bg-amber-600"
              >
                Normal Endowment (1 Stone)
              </Button>
              <Button 
                onClick={() => selectedEqId && endowItem({ id: selectedEqId, type: 'advanced', protect: useProtection })}
                disabled={endowPending || (player?.endowmentStones || 0) < 1}
                variant="outline"
                className="border-amber-700 text-amber-400 hover:bg-amber-900/20"
              >
                Advanced Endowment (1 Stone)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedEqId !== null && !endowDialogOpen} onOpenChange={(open) => !open && setSelectedEqId(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl border-b border-border/50 pb-2">Equip Item</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-4">Select who should wield this item (replaces same type):</p>

            <Button
              variant="outline"
              className="w-full justify-start h-12 bg-background/50"
              onClick={() => handleEquip(null, 'player')}
              disabled={isPending}
              data-testid="equip-to-player"
            >
              <Crosshair className="mr-3 text-muted-foreground" size={18} />
              Main Character (Daimyo)
            </Button>

            {companions?.filter(c => c.isInParty).map(comp => (
              <Button
                key={comp.id}
                variant="outline"
                className="w-full justify-start h-12 bg-background/50"
                onClick={() => handleEquip(comp.id, 'companion')}
                disabled={isPending}
                data-testid={`equip-to-companion-${comp.id}`}
              >
                <Shield className="mr-3 text-muted-foreground" size={18} />
                {comp.name}
              </Button>
            ))}

            {companions?.filter(c => c.isInParty).length === 0 && (
              <p className="text-xs text-muted-foreground italic mt-2">Add companions to your party to equip them.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
