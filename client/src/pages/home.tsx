import { usePlayer } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Shield, Sword, Coins, Wheat, Trophy } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: player, isLoading } = usePlayer();

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
    { label: "Gold", value: player.gold.toLocaleString(), icon: Coins, color: "text-yellow-400" },
    { label: "Rice", value: player.rice.toLocaleString(), icon: Wheat, color: "text-green-400" },
    { label: "Attack", value: player.attack, icon: Sword, color: "text-red-400" },
    { label: "Defense", value: player.defense, icon: Shield, color: "text-blue-400" },
  ];

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Daimyo's Quarters</h1>
          <p className="text-muted-foreground">Review your current standing and resources.</p>
        </div>

        {/* Hero Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-lg overflow-hidden border border-border/50 shadow-2xl h-64 sm:h-80"
        >
          {/* landing page hero japanese temple castle dark */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
          
          <div className="absolute bottom-0 left-0 p-8">
            <div className="inline-block px-3 py-1 bg-primary/20 border border-primary/30 rounded text-primary text-xs font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
              Lord of the Realm
            </div>
            <h2 className="text-4xl font-display font-bold text-white text-shadow-sm mb-2">{player.username || 'Wandering Samurai'}</h2>
            <p className="text-accent text-lg font-medium text-shadow">Level {player.level} • Exp: {player.experience}</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <h3 className="text-xl font-display font-semibold border-b border-border/50 pb-2 mt-12 mb-6">War Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border/50 rounded-lg p-6 flex flex-col items-center justify-center text-center hover-elevate bg-washi"
            >
              <div className={`p-3 rounded-full bg-background/50 border border-border mb-4 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <p className="text-sm text-muted-foreground mb-1 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold font-display text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
