import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sword, Users, Shield, Zap, Info } from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/" />;

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const mechanics = [
    {
      icon: Users,
      title: "Recruit Allies",
      desc: "Visit the Shrine to summon unique warrior companions. Build a party of up to 5 warriors to fight by your side."
    },
    {
      icon: Sword,
      title: "Master Combat",
      desc: "Progress through the Campaign Map. Face field bandits, storm castles, and challenge legendary Demon Lords."
    },
    {
      icon: Shield,
      title: "Forge Equipment",
      desc: "Loot weapons and armor from fallen foes. Upgrade and endow your gear at the Armory to increase your power."
    },
    {
      icon: Zap,
      title: "Spirit Bonds",
      desc: "Manage war horses and spirit pets in the Stable. They provide vital stat bonuses and unique skills in battle."
    }
  ];

  return (
    <div className="min-h-screen w-full bg-background relative overflow-y-auto flex flex-col items-center">
      {/* Hero Section */}
      <section className="min-h-screen w-full relative flex flex-col items-center justify-center shrink-0">
        <div 
          className="absolute inset-0 z-0 opacity-30 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop)' }}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background z-10" />

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-20 max-w-3xl mx-auto px-6 text-center flex flex-col items-center"
        >
          <div className="w-24 h-24 mb-8 border-2 border-accent/50 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <div className="w-16 h-16 border border-primary/50 rounded-full flex items-center justify-center">
              <span className="font-display text-4xl text-primary text-shadow-glow">戦</span>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold font-display text-white mb-6 tracking-wider text-shadow-lg">
            SENGOKU <span className="text-primary">CHRONICLES</span>
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-300 mb-12 max-w-2xl leading-relaxed">
            Unify the warring states. Gather legendary companions, forge powerful equipment, and carve your name into history.
          </p>
          
          <Button 
            onClick={handleLogin}
            className="bg-primary hover:bg-primary/90 text-white px-10 py-6 text-lg rounded-sm font-semibold tracking-widest border border-primary/50 shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all duration-300"
          >
            ENTER THE REALM
          </Button>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-16 animate-bounce"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Scroll to learn more</p>
            <div className="w-0.5 h-12 bg-gradient-to-b from-primary/50 to-transparent mx-auto" />
          </motion.div>
        </motion.div>
      </section>

      {/* How to Play Section */}
      <section className="w-full max-w-6xl mx-auto px-6 py-24 relative z-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            BEGIN YOUR <span className="text-accent">JOURNEY</span>
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {mechanics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card/50 border border-border/50 p-6 rounded-lg backdrop-blur-sm hover:border-primary/30 transition-colors group"
            >
              <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <m.icon className="text-primary" size={24} />
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-3">{m.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {m.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 p-8 bg-black/40 border border-border/30 rounded-xl max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-accent/10 rounded border border-accent/20">
              <Info className="text-accent" size={20} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2 tracking-wide uppercase">Core Loop</h4>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                The path to becoming Shogun is simple but challenging:
              </p>
              <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold uppercase tracking-wider">
                <li className="flex items-center gap-3 text-zinc-300">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0">1</span>
                  Fight & Loot
                </li>
                <li className="flex items-center gap-3 text-zinc-300">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0">2</span>
                  Upgrade Gear
                </li>
                <li className="flex items-center gap-3 text-zinc-300">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0">3</span>
                  Summon Allies
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="text-center mt-20">
          <Button 
            onClick={handleLogin}
            variant="outline"
            className="border-primary/50 text-primary hover:bg-primary/10"
          >
            START YOUR CHRONICLE NOW
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/30 py-12 px-6 text-center bg-black/20">
        <p className="text-zinc-600 text-xs tracking-widest uppercase font-bold">
          &copy; 2026 Sengoku Chronicles &bull; A Browser RPG Experience
        </p>
      </footer>
    </div>
  );
}
