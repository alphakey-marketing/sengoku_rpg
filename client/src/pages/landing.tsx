import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Redirect to="/" />;

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col items-center justify-center">
      {/* landing page hero scenic mountain landscape traditional japanese */}
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
      </motion.div>
    </div>
  );
}
