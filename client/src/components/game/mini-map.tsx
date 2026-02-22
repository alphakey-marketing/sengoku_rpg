import { motion } from "framer-motion";
import { Skull, Swords, Crown, User } from "lucide-react";

interface Location {
  id: number;
  name: string;
  level: number;
}

interface MiniMapProps {
  locations: Location[];
  currentLocationId: number;
  onLocationSelect: (id: number) => void;
}

export function MiniMap({ locations, currentLocationId, onLocationSelect }: MiniMapProps) {
  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-4 bg-washi shadow-xl">
      <h3 className="text-sm font-display font-bold text-gold uppercase tracking-widest mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
        Strategic Map
      </h3>
      
      <div className="relative h-48 bg-zinc-900/50 rounded border border-border/30 overflow-hidden">
        {/* Simple stylized map background grid */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', 
          backgroundSize: '20px 20px' 
        }} />
        
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {locations.slice(0, -1).map((loc, i) => {
            const nextLoc = locations[i+1];
            const x1 = 20 + (i * 20);
            const y1 = 80 - (i * 15);
            const x2 = 20 + ((i + 1) * 20);
            const y2 = 80 - ((i + 1) * 15);
            return (
              <line 
                key={`line-${i}`}
                x1={`${x1}%`} y1={`${y1}%`} 
                x2={`${x2}%`} y2={`${y2}%`} 
                stroke="currentColor" 
                strokeWidth="1" 
                className="text-border/30"
                strokeDasharray="4"
              />
            );
          })}
        </svg>

        {/* Location Markers */}
        {locations.map((loc, i) => {
          const isActive = loc.id === currentLocationId;
          const x = 20 + (i * 20);
          const y = 80 - (i * 15);
          
          return (
            <motion.button
              key={loc.id}
              whileHover={{ scale: 1.1 }}
              onClick={() => onLocationSelect(loc.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-full border-2 transition-colors z-10 ${
                isActive ? 'bg-primary border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-zinc-800 border-border/50 hover:border-primary/50'
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {loc.id === 4 ? (
                <Crown size={14} className={isActive ? 'text-white' : 'text-purple-400'} />
              ) : i === 0 ? (
                <User size={14} className={isActive ? 'text-white' : 'text-zinc-400'} />
              ) : (
                <Skull size={14} className={isActive ? 'text-white' : 'text-red-400'} />
              )}
              
              {/* Tooltip-like label */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap">
                <span className={`text-[10px] font-bold uppercase tracking-tighter px-1 rounded ${
                  isActive ? 'bg-white text-black' : 'bg-black/60 text-zinc-400'
                }`}>
                  {loc.name.split(' ')[0]}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Current</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> Enemy</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-400" /> Boss</div>
      </div>
    </div>
  );
}
