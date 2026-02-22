import { useState } from "react";
import { usePlayer, useGachaPull, Companion } from "@/hooks/use-game";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Sparkles, Star, Wheat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GachaPage() {
  const { data: player } = usePlayer();
  const { mutate: pull, isPending } = useGachaPull();
  
  const [result, setResult] = useState<Companion | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePull = () => {
    setResult(null);
    setIsAnimating(true);
    
    // Simulate anticipation delay
    setTimeout(() => {
      pull(undefined, {
        onSuccess: (data) => {
          setResult(data.companion);
          setIsAnimating(false);
        },
        onError: () => {
          setIsAnimating(false);
        }
      });
    }, 1500);
  };

  const cost = 100;
  const canAfford = (player?.rice || 0) >= cost;

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] max-w-4xl mx-auto">
        
        <div className="text-center mb-12 w-full">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-accent mb-4 text-shadow-glow">Shrine of Summons</h1>
          <p className="text-lg text-zinc-300">Offer rice to the local shrines to attract legendary warriors to your banner.</p>
          
          <div className="inline-flex items-center gap-3 mt-6 bg-card border border-border/50 px-6 py-3 rounded-full">
            <span className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Treasury</span>
            <div className="flex items-center gap-2 text-xl font-bold text-green-400">
              <Wheat size={20} />
              {player?.rice?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        {/* Summon Area */}
        <div className="relative w-full max-w-md aspect-[3/4] flex items-center justify-center">
          
          {/* Background circle decoration */}
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl"></div>
          
          <AnimatePresence mode="wait">
            {!result && !isAnimating && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative z-10 flex flex-col items-center"
              >
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-accent/30 animate-[spin_10s_linear_infinite] mb-8 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-2 border-primary/50 flex items-center justify-center animate-[spin_5s_linear_infinite_reverse]">
                    <Sparkles className="text-accent animate-pulse" size={32} />
                  </div>
                </div>
                
                <Button 
                  onClick={handlePull}
                  disabled={!canAfford || isPending}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-12 py-8 rounded-full text-xl font-bold border border-accent/50 shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all group"
                >
                  <span className="mr-3">Summon Companion</span>
                  <div className="flex items-center text-accent group-hover:text-white transition-colors text-base bg-black/30 px-3 py-1 rounded-full">
                    <Wheat size={16} className="mr-1" /> {cost}
                  </div>
                </Button>
                
                {!canAfford && (
                  <p className="text-destructive mt-4 text-sm font-medium">Not enough rice. Win battles to earn more.</p>
                )}
              </motion.div>
            )}

            {isAnimating && (
              <motion.div 
                key="animating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-10 text-center"
              >
                <div className="w-40 h-40 mx-auto rounded-full bg-accent/20 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(212,175,55,0.6)]">
                  <Sparkles className="text-accent animate-ping" size={48} />
                </div>
                <h2 className="text-2xl font-display font-bold text-accent tracking-widest animate-pulse">INCANTING...</h2>
              </motion.div>
            )}

            {result && !isAnimating && (
              <motion.div 
                key="result"
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="relative z-10 w-full"
              >
                <div className="bg-card border-2 border-accent rounded-xl p-8 text-center shadow-[0_0_40px_rgba(212,175,55,0.3)] bg-washi">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background border-2 border-accent px-4 py-1 rounded-full text-accent font-bold text-sm tracking-widest">
                    NEW ALLY
                  </div>
                  
                  <h2 className="text-4xl font-display font-bold text-white mb-2 mt-4">{result.name}</h2>
                  <p className="text-primary font-medium tracking-widest uppercase text-sm mb-6">{result.type} Hero</p>
                  
                  <div className="flex justify-center gap-1 text-accent mb-8">
                    {Array.from({ length: result.rarity }).map((_, j) => (
                      <motion.div 
                        key={j}
                        initial={{ opacity: 0, scale: 2 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + (j * 0.1) }}
                      >
                        <Star size={28} fill="currentColor" />
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-left bg-background/50 p-4 rounded-lg border border-border/50 mb-8">
                    <div><span className="text-muted-foreground text-sm">Level</span><p className="font-bold text-lg">{result.level}</p></div>
                    <div><span className="text-muted-foreground text-sm">Attack</span><p className="font-bold text-lg text-red-400">{result.attack}</p></div>
                    <div><span className="text-muted-foreground text-sm">Defense</span><p className="font-bold text-lg text-blue-400">{result.defense}</p></div>
                    <div><span className="text-muted-foreground text-sm">Skill</span><p className="font-bold text-sm text-accent truncate">{result.skill || 'None'}</p></div>
                  </div>

                  <Button 
                    onClick={() => setResult(null)}
                    variant="outline"
                    className="w-full border-accent text-accent hover:bg-accent/10"
                  >
                    Summon Again
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
