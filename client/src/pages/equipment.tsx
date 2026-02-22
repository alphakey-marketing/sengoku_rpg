import { useState } from "react";
import { useEquipment, useEquip, useCompanions } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sword, Shield, Crosshair } from "lucide-react";
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

  const [selectedEqId, setSelectedEqId] = useState<number | null>(null);

  const handleEquip = (targetId: number | null) => {
    if (selectedEqId) {
      equipItem({ equipmentId: selectedEqId, equippedToId: targetId });
      setSelectedEqId(null);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch(rarity) {
      case 'white': return 'text-zinc-400 border-zinc-700 bg-zinc-900/50';
      case 'green': return 'text-green-400 border-green-900 bg-green-900/10';
      case 'blue': return 'text-blue-400 border-blue-900 bg-blue-900/10';
      case 'purple': return 'text-purple-400 border-purple-900 bg-purple-900/10';
      case 'gold': return 'text-yellow-400 border-yellow-700 bg-yellow-900/20 shadow-[inset_0_0_15px_rgba(234,179,8,0.1)]';
      default: return 'text-white border-border bg-card';
    }
  };

  const getEquippedName = (equippedToId: number | null) => {
    if (equippedToId === null) return "Main Character";
    const comp = companions?.find(c => c.id === equippedToId);
    return comp ? comp.name : "Unknown";
  };

  if (eqLoading) return <MainLayout><div className="p-8">Opening armory...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-border/50 pb-4">
          <h1 className="text-3xl font-display font-bold text-white mb-2">Armory</h1>
          <p className="text-muted-foreground">Manage your weapons and armor.</p>
        </div>

        {equipment?.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <Sword className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">Armory Empty</h3>
            <p className="text-muted-foreground">Defeat enemies in the field to loot equipment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {equipment?.map((item) => (
              <div 
                key={item.id} 
                className={`relative p-5 rounded-lg border flex flex-col ${getRarityColor(item.rarity)} transition-transform hover:-translate-y-1`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg font-display truncate pr-2">{item.name}</h3>
                  <div className="uppercase text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-black/40 border border-white/10">
                    {item.type}
                  </div>
                </div>

                <div className="flex gap-4 mb-4 text-sm font-medium">
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
                  <div className="flex items-center gap-1 ml-auto text-zinc-400">
                    <span className="text-xs">LVL</span>
                    <span>{item.level}</span>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
                  {item.isEquipped ? (
                    <span className="text-xs text-accent">Eq: {getEquippedName(item.equippedToId)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">In Inventory</span>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-white/20 hover:bg-white/10 h-8 text-xs"
                    onClick={() => setSelectedEqId(item.id)}
                  >
                    Equip
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={selectedEqId !== null} onOpenChange={(open) => !open && setSelectedEqId(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl border-b border-border/50 pb-2">Equip Item</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-4">Select who should wield this item:</p>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-12 bg-background/50 hover:bg-primary/20 hover:text-primary hover:border-primary/50"
              onClick={() => handleEquip(null)}
              disabled={isPending}
            >
              <Crosshair className="mr-3 text-muted-foreground" size={18} />
              Main Character (Daimyo)
            </Button>
            
            {companions?.filter(c => c.isInParty).map(comp => (
              <Button 
                key={comp.id}
                variant="outline" 
                className="w-full justify-start h-12 bg-background/50 hover:bg-accent/20 hover:text-accent hover:border-accent/50"
                onClick={() => handleEquip(comp.id)}
                disabled={isPending}
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
