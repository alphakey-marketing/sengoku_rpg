/**
 * client/src/components/intro-overlay.tsx
 *
 * Fullscreen cinematic title card shown exactly once per account,
 * immediately after first login and before routing to /story.
 *
 * Dismisses automatically after 4 seconds OR when the player taps/clicks.
 * On dismiss it calls onDismiss() which hits POST /api/player/mark-intro-seen
 * so the overlay never reappears.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroOverlayProps {
  onDismiss: () => void;
}

export function IntroOverlay({ onDismiss }: IntroOverlayProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 600); // wait for fade-out animation
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  function handleClick() {
    setVisible(false);
    setTimeout(onDismiss, 600);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          onClick={handleClick}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center
                     bg-black cursor-pointer select-none"
        >
          {/* Clan crest */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="w-28 h-28 rounded-full border-2 border-primary/60
                       flex items-center justify-center mb-8
                       shadow-[0_0_60px_rgba(220,38,38,0.4)]"
          >
            <span className="font-display text-6xl text-primary">戦</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="text-4xl font-bold font-display text-white tracking-[0.3em] uppercase"
          >
            Sengoku{" "}
            <span className="text-primary">Chronicles</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-4 text-zinc-400 text-sm tracking-widest uppercase"
          >
            Your story begins in Owari Province…
          </motion.p>

          {/* Tap hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 2, duration: 1.5, repeat: Infinity }}
            className="absolute bottom-12 text-xs text-zinc-600 tracking-widest uppercase"
          >
            Tap to continue
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
