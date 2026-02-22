import { useState } from "react";
import { useEquipment, useEquip, useUnequip, useCompanions } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sword, Shield, Crosshair, Zap, Sparkles, ArrowUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EquipmentPage() {
  const { data: equipment, isLoading: eqLoading } = useEquipment();
  const { data: companions } = useCompanions();
  const { mutate: equipItem, isPending } = useEquip();
  const { mutate: unequipItem, isPending: unequipPending } = useUnequip();

  const [selectedEqId, setSelectedEqId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

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
      case 'gold': return 'text-yellow-400 border-yellow-700 bg-yellow-900/20 shadow-[inset_0_0_15px_rgba(234,179,8,0.1)]';
      default: return 'text-white border-border bg-card';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'weapon': return Sword;
      case 'armor': return Shield;
      case 'accessory': return Sparkles;
      case 'horse_gear': return Zap;
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

  const filtered = filterType === 'all' ? equipment : equipment?.filter(e => e.type === filterType);

  if (eqLoading) return <MainLayout><div className="p-8">Opening armory...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-border/50 pb-4">
          <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">Armory</h1>
          <p className="text-muted-foreground">Manage weapons, armor, and gear. Only one item per type can be equipped.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'weapon', 'armor', 'accessory', 'horse_gear'].map(t => (
            <Button
              key={t}
              size="sm"
              variant={filterType === t ? "default" : "outline"}
              onClick={() => setFilterType(t)}
              data-testid={`filter-${t}`}
            >
              {t === 'all' ? 'All' : typeLabel(t)}
            </Button>
          ))}
        </div>

        {filtered?.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <Sword className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">Armory Empty</h3>
            <p className="text-muted-foreground">Defeat enemies in the field to loot equipment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered?.map((item) => {
              const TypeIcon = getTypeIcon(item.type);
              const equippedTo = getEquippedName(item);
              return (
                <div
                  key={item.id}
                  className={`relative p-5 rounded-lg border flex flex-col ${getRarityColor(item.rarity)} transition-transform hover:-translate-y-1`}
                  data-testid={`equipment-card-${item.id}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <TypeIcon size={16} />
                      <h3 className="font-bold text-lg font-display truncate pr-2">{item.name}</h3>
                    </div>
                    <div className="uppercase text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-black/40 border border-white/10">
                      {typeLabel(item.type)}
                    </div>
                  </div>

                  <div className="flex gap-3 mb-2 text-sm font-medium flex-wrap">
                    {item.attackBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Sword size={14} className="text-red-400" />
                        <span>+{item.attackBonus}</span>
                      </div>
                    )}
                    {item.defenseBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Shield size={14} className="text-blue-400" />
                        <span>+{item.defenseBonus}</span>
                      </div>
                    )}
                    {item.speedBonus > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap size={14} className="text-cyan-400" />
                        <span>+{item.speedBonus}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <div className="flex items-center gap-1">
                        <ArrowUp size={12} />
                        <span>Lv {item.level}</span>
                      </div>
                      <span>{item.experience}/{item.expToNext} EXP</span>
                    </div>
                    <Progress value={(item.experience / item.expToNext) * 100} className="h-1.5" />
                    <p className="text-[10px] text-zinc-500 mt-1">+5% ATK / +8% DEF / +10% SPD per level</p>
                  </div>

                  <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    {equippedTo ? (
                      <span className="text-xs text-accent truncate">Eq: {equippedTo}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">In Inventory</span>
                    )}
                    <div className="flex gap-1">
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

      <Dialog open={selectedEqId !== null} onOpenChange={(open) => !open && setSelectedEqId(null)}>
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
