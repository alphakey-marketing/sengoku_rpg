import { usePlayerFullStatus, useEquipment, useEquip, useUnequip } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Shield, Sword, Zap, Sparkles, Plus, Package, Heart, Crosshair } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function GearPage() {
  const { data: teamStatus, isLoading } = usePlayerFullStatus();
  const { data: equipment } = useEquipment();
  const { mutate: equipItem, isPending: equipPending } = useEquip();
  const { mutate: unequipItem, isPending: unequipPending } = useUnequip();

  const [selectedSlot, setSelectedSlot] = useState<{ type: string, targetId: number | null, targetType: string } | null>(null);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-muted-foreground">Inspecting the army's gear...</div>
      </MainLayout>
    );
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'gold': return 'text-yellow-400 border-yellow-700 bg-yellow-900/10';
      case 'purple': return 'text-purple-400 border-purple-700 bg-purple-900/10';
      case 'blue': return 'text-blue-400 border-blue-700 bg-blue-900/10';
      case 'green': return 'text-green-400 border-green-700 bg-green-900/10';
      case 'mythic': return 'text-pink-400 border-pink-700 bg-pink-900/10 shadow-[0_0_20px_rgba(236,72,153,0.3)]';
      case 'exotic': return 'text-teal-400 border-teal-700 bg-teal-900/10 shadow-[0_0_25px_rgba(20,184,166,0.4)]';
      case 'transcendent': return 'text-zinc-100 border-white/20 bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-pulse';
      case 'celestial': return 'text-white border-zinc-200 bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.5)] font-bold';
      case 'primal': return 'text-red-600 border-red-900 bg-black shadow-[0_0_50px_rgba(220,38,38,0.6)] font-black uppercase tracking-tighter';
      default: return 'text-zinc-400 border-zinc-700 bg-zinc-900/20';
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

  const renderGearSection = (title: string, entityGear: any[], stats?: any, targetId: number | null = null, targetType: string = 'player') => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/50 pb-2 gap-4">
        <h3 className="text-xl font-display font-semibold">{title}</h3>
        {stats && (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 bg-red-900/10 px-2 py-1 rounded border border-red-900/20">
              <Heart size={14} className="text-red-400" />
              <span className="text-zinc-400 font-medium">HP:</span>
              <span className="text-white font-bold">{stats.hp}/{stats.maxHp}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-900/10 px-2 py-1 rounded border border-red-900/20">
              <Sword size={14} className="text-red-400" />
              <span className="text-zinc-400 font-medium">ATK:</span>
              <span className="text-white font-bold">{stats.displayATK || stats.attack}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-900/10 px-2 py-1 rounded border border-blue-900/20">
              <Shield size={14} className="text-blue-400" />
              <span className="text-zinc-400 font-medium">DEF:</span>
              <span className="text-white font-bold">{stats.defense} ({stats.softMDEF})</span>
            </div>
            <div className="flex items-center gap-1.5 bg-cyan-900/10 px-2 py-1 rounded border border-cyan-900/20">
              <Zap size={14} className="text-cyan-400" />
              <span className="text-zinc-400 font-medium">SPD:</span>
              <span className="text-white font-bold">{stats.speed}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-orange-900/10 px-2 py-1 rounded border border-orange-900/20">
              <Sparkles size={14} className="text-orange-400" />
              <span className="text-zinc-400 font-medium">Crit:</span>
              <span className="text-white font-bold">{stats.critChance}%</span>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['weapon', 'shield', 'armor', 'garment', 'footgear', 'accessory', 'headgearUpper', 'headgearMiddle', 'headgearLower'].map(type => {
          const item = entityGear?.find(e => e.type === type);
          const TypeIcon = getTypeIcon(type);
          const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace(/[A-Z]/g, ' $&');
          
          return (
            <div
              key={type}
              className={`rounded-lg border p-4 bg-card bg-washi flex items-center gap-3 relative group ${item ? 'text-zinc-400 border-zinc-700 bg-zinc-900/20' : 'border-border/30 opacity-50'}`}
            >
              <div className="p-2 bg-background/50 rounded border border-border/50 shrink-0">
                <TypeIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{typeLabel}</p>
                {item ? (
                  <>
                    <p className="font-bold text-sm truncate">
                      {item.name}{item.endowmentPoints > 0 ? ` +${item.endowmentPoints}` : ''}
                    </p>
                    {item.weaponType && (
                      <p className="text-[9px] text-zinc-500 font-mono uppercase leading-none mb-1">
                        {item.weaponType}
                      </p>
                    )}
                    <div className="flex gap-2 text-[10px] mt-1 flex-wrap">
                      <span className="font-bold">Lv{item.level}</span>
                      {item.attackBonus > 0 && <span className="text-red-400">+{item.attackBonus} ATK</span>}
                      {item.matkBonus > 0 && <span className="text-purple-400">+{item.matkBonus} MATK</span>}
                      {item.defenseBonus > 0 && <span className="text-blue-400">+{item.defenseBonus} DEF</span>}
                      {item.mdefBonus > 0 && <span className="text-cyan-400">+{item.mdefBonus} MDEF</span>}
                      {item.hpBonus > 0 && <span className="text-red-500">+{item.hpBonus} HP</span>}
                      {item.speedBonus > 0 && <span className="text-cyan-400">+{item.speedBonus} SPD</span>}
                      {item.fleeBonus > 0 && <span className="text-green-400">+{item.fleeBonus} FLEE</span>}
                    </div>
                    <div className="mt-1.5 mb-2">
                      <Progress value={(item.experience / item.expToNext) * 100} className="h-1" />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedSlot({ type, targetId, targetType })}
                        className="text-[10px] text-accent hover:underline font-bold uppercase tracking-wider"
                      >
                        Change
                      </button>
                      <button 
                        onClick={() => unequipItem(item.id)}
                        disabled={unequipPending}
                        className="text-[10px] text-destructive hover:underline font-bold uppercase tracking-wider"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-start">
                    <p className="text-sm text-zinc-500 italic mb-1">Empty Slot</p>
                    <button 
                      onClick={() => setSelectedSlot({ type, targetId, targetType })}
                      className="text-[10px] text-accent hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus size={10} /> Equip {typeLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const inventoryItems = selectedSlot 
    ? equipment?.filter(e => {
        // Normalize type matching
        const itemType = e.type.toLowerCase();
        const slotType = selectedSlot.type.toLowerCase();
        
        // Match specific slot types or allow general type matching
        const isTypeMatch = itemType === slotType || 
          (slotType === 'headgearupper' && itemType === 'headgear') ||
          (slotType === 'headgearmiddle' && itemType === 'headgear') ||
          (slotType === 'headgearlower' && itemType === 'headgear');

        return isTypeMatch && !e.isEquipped;
      }) 
    : [];

  return (
    <MainLayout>
      <div className="space-y-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">Battle Formations</h1>
            <p className="text-muted-foreground">Manage equipment for your entire war council in one place.</p>
          </div>
          <Button variant="outline" asChild size="sm" className="gap-2">
            <a href="/equipment">
              <Package size={16} />
              Open Armory
            </a>
          </Button>
        </div>

        {renderGearSection("Main Character (Daimyo)", equipment?.filter(e => e.isEquipped && e.equippedToType === 'player') || [], teamStatus?.player, null, 'player')}

        {teamStatus?.companions?.map((companion: any) => {
          const companionGear = equipment?.filter(e => 
            e.isEquipped && 
            e.equippedToType === 'companion' && 
            Number(e.equippedToId) === Number(companion.id)
          ) || [];
          
          return (
            <div key={companion.id}>
               {renderGearSection(companion.name, companionGear, companion, companion.id, 'companion')}
            </div>
          );
        })}

        {(!teamStatus?.companions || teamStatus.companions.length === 0) && (
          <div className="p-8 text-center bg-card rounded-lg border border-dashed border-border/50">
            <p className="text-muted-foreground italic text-sm">No companions in party. Recruit warriors at the Shrine of Summons.</p>
          </div>
        )}
      </div>

      <Dialog open={selectedSlot !== null} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Change {selectedSlot ? (selectedSlot.type === 'horse_gear' ? 'Horse Gear' : selectedSlot.type.charAt(0).toUpperCase() + selectedSlot.type.slice(1)) : 'Gear'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {inventoryItems?.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground italic">No available {selectedSlot?.type.replace('_', ' ')} in inventory.</p>
                </div>
              ) : (
                inventoryItems?.map(item => (
                  <div key={item.id} className="p-3 rounded-lg border flex justify-between items-center text-zinc-400 border-zinc-700 bg-zinc-900/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.name}</p>
                      <p className="text-[10px] opacity-70">Lv{item.level} • {item.type.replace('_', ' ')}</p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        equipItem({ 
                          equipmentId: item.id, 
                          equippedToId: selectedSlot?.targetId ?? null, 
                          equippedToType: selectedSlot?.targetType ?? 'player' 
                        });
                        setSelectedSlot(null);
                      }}
                      disabled={equipPending}
                      className="h-8 text-[10px] px-3 font-bold uppercase tracking-wider"
                    >
                      Equip
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
