import { usePlayerFullStatus, useEquipment } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Shield, Sword, Zap, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function GearPage() {
  const { data: teamStatus, isLoading } = usePlayerFullStatus();
  const { data: equipment } = useEquipment();

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
      case 'mythic': return 'text-pink-400 border-pink-700 bg-pink-900/10';
      case 'exotic': return 'text-teal-400 border-teal-700 bg-teal-900/10';
      case 'transcendent': return 'text-zinc-100 border-white/20 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.2)]';
      case 'celestial': return 'text-white border-zinc-200 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.4)]';
      case 'primal': return 'text-red-500 border-red-900 bg-black shadow-[0_0_40px_rgba(220,38,38,0.5)]';
      default: return 'text-zinc-400 border-zinc-700 bg-zinc-900/20';
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

  const renderGearSection = (title: string, entityGear: any[]) => (
    <div className="space-y-4">
      <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['weapon', 'armor', 'accessory', 'horse_gear'].map(type => {
          const item = entityGear?.find(e => e.type === type);
          const TypeIcon = getTypeIcon(type);
          const typeLabel = type === 'horse_gear' ? 'Horse Gear' : type.charAt(0).toUpperCase() + type.slice(1);
          
          return (
            <div
              key={type}
              className={`rounded-lg border p-4 bg-card bg-washi flex items-center gap-3 ${item ? getRarityColor(item.rarity) : 'border-border/30 opacity-50'}`}
            >
              <div className="p-2 bg-background/50 rounded border border-border/50 shrink-0">
                <TypeIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{typeLabel}</p>
                {item ? (
                  <>
                    <p className="font-bold text-sm truncate">{item.name}{item.endowmentPoints > 0 ? ` +${item.endowmentPoints}` : ''}</p>
                    <div className="flex gap-2 text-[10px] mt-1 flex-wrap">
                      <span className="font-bold">Lv{item.level}</span>
                      {item.attackBonus > 0 && <span className="text-red-400">+{item.attackBonus} ATK</span>}
                      {item.defenseBonus > 0 && <span className="text-blue-400">+{item.defenseBonus} DEF</span>}
                      {item.speedBonus > 0 && <span className="text-cyan-400">+{item.speedBonus} SPD</span>}
                    </div>
                    <div className="mt-1.5">
                      <Progress value={(item.experience / item.expToNext) * 100} className="h-1" />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500 italic">No {typeLabel} equipped</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-12">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Battle Formations</h1>
          <p className="text-muted-foreground">Inspect the equipment of your entire war council.</p>
        </div>

        {renderGearSection("Main Character (Daimyo)", equipment?.filter(e => e.isEquipped && e.equippedToType === 'player') || [])}

        {teamStatus?.companions?.map((companion: any) => (
          <div key={companion.id}>
             {renderGearSection(companion.name, equipment?.filter(e => e.isEquipped && e.equippedToType === 'companion' && e.equippedToId === companion.id) || [])}
          </div>
        ))}

        {(!teamStatus?.companions || teamStatus.companions.length === 0) && (
          <div className="p-8 text-center bg-card rounded-lg border border-dashed border-border/50">
            <p className="text-muted-foreground italic text-sm">No companions in party. Recruit warriors at the Shrine of Summons.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
