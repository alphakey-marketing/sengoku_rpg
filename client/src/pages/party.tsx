import { useState } from "react";
import { useCompanions, useSetParty, useEquipment, Companion } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Users, Star, Sword, Shield, Zap, Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function Party() {
  const { data: companions, isLoading } = useCompanions();
  const { data: equipment } = useEquipment();
  const { mutate: setParty, isPending } = useSetParty();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  if (companions && selectedIds.length === 0 && companions.some(c => c.isInParty)) {
    setSelectedIds(companions.filter(c => c.isInParty).map(c => c.id));
  }

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(cId => cId !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleSave = () => setParty(selectedIds);

  const getCompEquipped = (compId: number) => equipment?.filter(e => e.isEquipped && e.equippedToType === 'companion' && e.equippedToId === compId) || [];

  if (isLoading) return <MainLayout><div className="p-8">Loading companions...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">War Council</h1>
            <p className="text-muted-foreground">Select up to 5 companions for your active party.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium bg-secondary/30 px-3 py-1 rounded border border-secondary text-secondary-foreground">
              {selectedIds.length} / 5 Selected
            </span>
            <Button
              onClick={handleSave}
              disabled={isPending || selectedIds.length === 0}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              data-testid="button-deploy-party"
            >
              {isPending ? "Updating..." : "Deploy Party"}
            </Button>
          </div>
        </div>

        {companions?.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No Companions Yet</h3>
            <p className="text-muted-foreground">Visit the Shrine to summon allies to your cause.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {companions?.map((comp, i) => {
              const isSelected = selectedIds.includes(comp.id);
              const compEquip = getCompEquipped(comp.id);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={comp.id}
                  onClick={() => toggleSelection(comp.id)}
                  className={`
                    relative cursor-pointer rounded-lg p-5 transition-all duration-300 border bg-washi
                    ${isSelected
                      ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                      : 'bg-card border-border/50 hover:border-accent/40 hover:bg-card/80'}
                  `}
                  data-testid={`companion-card-${comp.id}`}
                >
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'}
                  `}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>

                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded bg-background border border-border flex items-center justify-center shrink-0">
                      <Users className={isSelected ? 'text-primary' : 'text-muted-foreground'} size={32} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold font-display text-lg text-white">{comp.name}</h3>
                      </div>
                      <div className="flex text-accent mb-3">
                        {Array.from({ length: comp.rarity }).map((_, j) => (
                          <Star key={j} size={14} fill="currentColor" />
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1 text-zinc-300">
                          <span className="text-muted-foreground text-xs">LVL</span>
                          <span className="font-bold">{comp.level}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Heart size={14} className="text-red-400" />
                          <span>{comp.hp}/{comp.maxHp}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Sword size={14} className="text-orange-400" />
                          <span>{comp.attack}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Shield size={14} className="text-blue-400" />
                          <span>{comp.defense}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Zap size={14} className="text-cyan-400" />
                          <span>{comp.speed}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {compEquip.length > 0 && (
                    <div className="mt-3 p-2 bg-background/50 rounded border border-border/30 text-xs text-zinc-400 space-y-1">
                      <span className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Equipped</span>
                      {compEquip.map(e => (
                        <div key={e.id} className="flex justify-between">
                          <span>{e.name} (Lv{e.level})</span>
                          <span className="text-zinc-500">{e.type}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {comp.skill && (
                    <div className="mt-3 p-2 bg-background/50 rounded text-xs text-zinc-400 border border-border/30">
                      <span className="text-accent mr-2">Skill:</span>
                      {comp.skill}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
