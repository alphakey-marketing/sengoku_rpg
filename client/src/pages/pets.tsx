import { usePets, useSetActivePet, useRecyclePet, useUpgradePet, usePlayer } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Heart, Sword, Shield, Zap, Sparkles, ArrowUp, Trash2, Hammer, FlaskConical } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function PetsPage() {
  const { data: player } = usePlayer();
  const { data: pets, isLoading } = usePets();
  const { mutate: setActive } = useSetActivePet();
  const { mutate: recyclePet, isPending: recyclePending } = useRecyclePet();
  const { mutate: upgradePet, isPending: upgradePending } = useUpgradePet();

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'white': return 'text-zinc-400 border-zinc-700 bg-zinc-900/50';
      case 'green': return 'text-green-400 border-green-900 bg-green-900/10';
      case 'blue': return 'text-blue-400 border-blue-900 bg-blue-900/10';
      case 'purple': return 'text-purple-400 border-purple-900 bg-purple-900/10';
      case 'gold': return 'text-yellow-400 border-yellow-700 bg-yellow-900/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]';
      case 'mythic': return 'text-pink-400 border-pink-900 bg-pink-900/10 shadow-[0_0_20px_rgba(236,72,153,0.3)]';
      case 'exotic': return 'text-teal-400 border-teal-900 bg-teal-900/10 shadow-[0_0_25px_rgba(20,184,166,0.4)]';
      case 'transcendent': return 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-green-400 to-blue-400 border-white/20 bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.3)] font-black animate-pulse';
      case 'celestial': return 'text-white border-zinc-200 bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.5)] font-bold';
      case 'primal': return 'text-red-600 border-red-900 bg-black shadow-[0_0_50px_rgba(220,38,38,0.6)] font-black uppercase tracking-tighter';
      default: return 'text-white border-border bg-card';
    }
  };

  const getRarityDescription = (rarity: string) => {
    switch (rarity) {
      case 'white': return 'Basic companion with minimal stat growth.';
      case 'green': return 'Common spirit with reliable base stats.';
      case 'blue': return 'Rare guardian with improved growth potential.';
      case 'purple': return 'Epic spirit possessing significant power bonuses.';
      case 'gold': return 'Legendary companion with exceptional stat scaling.';
      case 'mythic': return 'Ancient spirit with immense power and presence.';
      case 'exotic': return 'Otherworldly being with unique and potent stats.';
      case 'transcendent': return 'Divine guardian transcending mortal limits.';
      case 'celestial': return 'Cosmic entity with overwhelming celestial energy.';
      case 'primal': return 'The ultimate progenitor of spirit power.';
      default: return '';
    }
  };

  if (isLoading) return <MainLayout><div className="p-8">Whistling for pets...</div></MainLayout>;

  const sortedPets = pets ? [...pets].sort((a, b) => a.id - b.id) : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-border/50 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">Pet Menagerie</h1>
            <p className="text-muted-foreground">Manage your spirit companions. Only one pet can accompany you in battle.</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-700/30 px-4 py-2 rounded-lg">
            <FlaskConical size={18} className="text-blue-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-blue-300 uppercase font-bold tracking-wider">Pet Essence</span>
              <span className="text-lg font-bold text-white leading-none">{player?.petEssence || 0}</span>
            </div>
          </div>
        </div>

        {sortedPets.length === 0 ? (
          <div className="text-center p-12 bg-card rounded-lg border border-border/50 border-dashed">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No Pets Found</h3>
            <p className="text-muted-foreground">Explore the map or summon at the shrine to find pets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPets.map((pet) => (
              <div
                key={pet.id}
                className={`relative p-5 rounded-lg border flex flex-col ${getRarityColor(pet.rarity)} transition-all ${pet.isActive ? 'ring-2 ring-accent scale-[1.02]' : ''}`}
                data-testid={`pet-card-${pet.id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} />
                    <h3 className="font-bold text-lg font-display truncate">{pet.name}</h3>
                  </div>
                  {pet.isActive && (
                    <span className="bg-accent text-accent-foreground text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Active</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded">
                    <Heart size={12} className="text-red-400" />
                    <span>{pet.hp}/{pet.maxHp}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded">
                    <Sword size={12} className="text-orange-400" />
                    <span>{pet.attack} ATK</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded">
                    <Shield size={12} className="text-blue-400" />
                    <span>{pet.defense} DEF</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded">
                    <Zap size={12} className="text-cyan-400" />
                    <span>{pet.speed} SPD</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 uppercase font-bold tracking-widest">
                    <span>Lv {pet.level}</span>
                    <span>{pet.experience}/{pet.expToNext} EXP</span>
                  </div>
                  <Progress value={(pet.experience / pet.expToNext) * 100} className="h-1.5" />
                </div>

                <div className="text-[10px] text-zinc-500 italic mb-4 leading-tight">
                  {getRarityDescription(pet.rarity)}
                </div>

                {pet.skill && (
                  <div className="bg-black/40 p-2 rounded text-[10px] mb-4 border border-white/5 italic text-zinc-300">
                    Skill: {pet.skill}
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-white/10 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    variant={pet.isActive ? "secondary" : "default"}
                    onClick={() => setActive(pet.id)}
                    disabled={pet.isActive}
                  >
                    {pet.isActive ? "Equipped" : "Equip Pet"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-900/30 text-purple-400 px-2"
                    onClick={() => {
                      const amount = prompt("How much essence to use?", "1");
                      if (amount) {
                        const n = parseInt(amount);
                        if (!isNaN(n) && n > 0) {
                          upgradePet({ id: pet.id, amount: n });
                        }
                      }
                    }}
                    disabled={upgradePending || (player?.petEssence || 0) < 10}
                    title="Upgrade with essence"
                    data-testid={`upgrade-pet-${pet.id}`}
                  >
                    <Hammer size={14} />
                  </Button>
                  {!pet.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-900/30 text-red-400 px-2"
                      onClick={() => recyclePet(pet.id)}
                      disabled={recyclePending}
                      title="Recycle for Essence"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
