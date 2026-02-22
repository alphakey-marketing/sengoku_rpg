import { usePlayer, usePlayerFullStatus, useEquipment, useTransformations } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Shield, Sword, Coins, Wheat, Trophy, Zap, Heart, Sparkles, CloudRain, Sun, Cloud, Wind, Snowflake } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const WeatherIcon = ({ weather }: { weather: string }) => {
  switch (weather) {
    case 'rain': return <CloudRain className="w-5 h-5 text-blue-400" />;
    case 'storm': return <Wind className="w-5 h-5 text-slate-400" />;
    case 'fog': return <Cloud className="w-5 h-5 text-gray-300" />;
    case 'snow': return <Snowflake className="w-5 h-5 text-blue-100" />;
    default: return <Sun className="w-5 h-5 text-yellow-400" />;
  }
};

export default function Home() {
  const { data: player, isLoading } = usePlayer();
  const { data: teamStatus } = usePlayerFullStatus();
  const { data: equipment } = useEquipment();
  const { data: transforms } = useTransformations();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-muted-foreground font-display">Gathering Intel...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!player) return null;

  const statCards = [
    { label: "Level", value: player.level, icon: Trophy, color: "text-purple-400" },
    { label: "HP", value: `${player.hp}/${player.maxHp}`, icon: Heart, color: "text-red-400" },
    { label: "ATK", value: teamStatus?.player.attack || player.attack, icon: Sword, color: "text-orange-400" },
    { label: "DEF", value: teamStatus?.player.defense || player.defense, icon: Shield, color: "text-blue-400" },
    { label: "SPD", value: teamStatus?.player.speed || player.speed, icon: Zap, color: "text-cyan-400" },
    { label: "Gold", value: player.gold.toLocaleString(), icon: Coins, color: "text-yellow-400" },
    { label: "Rice", value: player.rice.toLocaleString(), icon: Wheat, color: "text-green-400" },
  ];

  const equippedItems = equipment?.filter(e => e.isEquipped && e.equippedToType === 'player') || [];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'gold': return 'text-yellow-400 border-yellow-700';
      case 'purple': return 'text-purple-400 border-purple-700';
      case 'blue': return 'text-blue-400 border-blue-700';
      case 'green': return 'text-green-400 border-green-700';
      default: return 'text-zinc-400 border-zinc-700';
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

  const expPercent = player.level > 0 ? Math.min(100, (player.experience / (player.level * 100)) * 100) : 0;

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2" data-testid="text-page-title">Daimyo's Quarters</h1>
          <p className="text-muted-foreground">Review your current standing and resources.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-lg overflow-hidden border border-border/50 shadow-2xl h-64 sm:h-72"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8">
            <div className="inline-block px-3 py-1 bg-primary/20 border border-primary/30 rounded text-primary text-xs font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
              Lord of the Realm
            </div>
            {player.weather && (
              <div className="flex items-center gap-2 mb-2 bg-black/40 w-fit px-2 py-1 rounded border border-border/30">
                <WeatherIcon weather={player.weather as string} />
                <span className="text-[10px] text-gold font-bold uppercase tracking-wider">{player.weather}</span>
              </div>
            )}
            <h2 className="text-4xl font-display font-bold text-white text-shadow-sm mb-2" data-testid="text-player-name">{player.firstName || 'Wandering Samurai'}</h2>
            <p className="text-accent text-lg font-medium text-shadow">Level {player.level}</p>
            <div className="mt-2 w-48">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>EXP</span>
                <span>{player.experience} / {player.level * 100}</span>
              </div>
              <Progress value={expPercent} className="h-2" />
            </div>
          </div>
        </motion.div>

        <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mt-12 mb-6">War Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border/50 rounded-lg p-4 flex flex-col items-center justify-center text-center hover-elevate bg-washi"
              data-testid={`stat-${stat.label.toLowerCase()}`}
            >
              <div className={`p-2 rounded-full bg-background/50 border border-border mb-3 ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">{stat.label}</p>
              <p className="text-lg font-bold font-display text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mt-8 mb-4">Equipped Gear</h3>
        {equippedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment is currently worn. Visit the Armory to equip items.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {['weapon', 'armor', 'accessory', 'horse_gear'].map(type => {
              const item = equippedItems.find(e => e.type === type);
              const TypeIcon = getTypeIcon(type);
              const typeLabel = type === 'horse_gear' ? 'Horse Gear' : type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <div
                  key={type}
                  className={`rounded-lg border p-4 bg-card bg-washi flex items-center gap-3 ${item ? getRarityColor(item.rarity) : 'border-border/30 opacity-50'}`}
                  data-testid={`equipped-${type}`}
                >
                  <div className="p-2 bg-background/50 rounded border border-border/50">
                    <TypeIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{typeLabel}</p>
                    {item ? (
                      <>
                        <p className="font-bold text-sm truncate">{item.name}</p>
                        <div className="flex gap-2 text-xs mt-1">
                          <span>Lv{item.level}</span>
                          {item.attackBonus > 0 && <span className="text-red-400">+{item.attackBonus} ATK</span>}
                          {item.defenseBonus > 0 && <span className="text-blue-400">+{item.defenseBonus} DEF</span>}
                          {item.speedBonus > 0 && <span className="text-cyan-400">+{item.speedBonus} SPD</span>}
                        </div>
                        <div className="mt-1">
                          <Progress value={(item.experience / item.expToNext) * 100} className="h-1" />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500">Empty</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {teamStatus?.pet && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Active Pet</h3>
            <div className="bg-card border border-accent/30 rounded-lg p-4 bg-washi flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-full border border-accent/30">
                <Sparkles size={24} className="text-accent" />
              </div>
              <div>
                <p className="font-bold text-white">{teamStatus.pet.name}</p>
                <p className="text-xs text-muted-foreground">Lv{teamStatus.pet.level} | ATK {teamStatus.pet.attack} | DEF {teamStatus.pet.defense} | SPD {teamStatus.pet.speed}</p>
                {teamStatus.pet.skill && <p className="text-xs text-accent mt-1">Skill: {teamStatus.pet.skill}</p>}
              </div>
            </div>
          </div>
        )}

        {teamStatus?.horse && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Active Horse</h3>
            <div className="bg-card border border-cyan-700/30 rounded-lg p-4 bg-washi flex items-center gap-4">
              <div className="p-3 bg-cyan-900/20 rounded-full border border-cyan-700/30">
                <Zap size={24} className="text-cyan-400" />
              </div>
              <div>
                <p className="font-bold text-white">{teamStatus.horse.name}</p>
                <p className="text-xs text-muted-foreground">Lv{teamStatus.horse.level} | +{teamStatus.horse.speedBonus} SPD | +{teamStatus.horse.attackBonus} ATK</p>
                {teamStatus.horse.skill && <p className="text-xs text-cyan-400 mt-1">Skill: {teamStatus.horse.skill}</p>}
              </div>
            </div>
          </div>
        )}

        {transforms && transforms.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mb-4">Transformations (変身)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {transforms.map(t => (
                <div key={t.id} className="bg-card border border-purple-700/40 rounded-lg p-4 bg-washi shadow-[0_0_15px_rgba(128,0,255,0.1)]">
                  <p className="font-bold text-purple-300 text-lg font-display">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Lv{t.level} | {t.durationSeconds}s duration | {t.cooldownSeconds}s cooldown</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <span className="text-red-400">+{t.attackPercent}% ATK</span>
                    <span className="text-blue-400">+{t.defensePercent}% DEF</span>
                    <span className="text-cyan-400">+{t.speedPercent}% SPD</span>
                    <span className="text-green-400">+{t.hpPercent}% HP</span>
                  </div>
                  <p className="text-xs text-accent mt-2">Skill: {t.skill}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
