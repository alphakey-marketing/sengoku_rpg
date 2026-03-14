import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Lock } from "lucide-react";
import { Link } from "wouter";
import type { PlayerFlag } from "@/hooks/use-story";

interface Chapter {
  id: number;
  title: string;
  isCompleted: boolean;
  isUnlocked: boolean;
  currentSceneId: number | null;
}

interface Props {
  flags: PlayerFlag[];
  chapters: Chapter[];
}

export function StoryProgressBanner({ flags, chapters }: Props) {
  if (!chapters || chapters.length === 0) return null;

  const completed = chapters.filter(c => c.isCompleted);
  const current   = chapters.find(c => c.isUnlocked && !c.isCompleted);
  const locked    = chapters.filter(c => !c.isUnlocked);
  const totalChapters = chapters.length;
  const percent = totalChapters > 0 ? Math.round((completed.length / totalChapters) * 100) : 0;

  const unlockedCompanions = flags.filter(f => f.flagKey.startsWith("companion_unlocked_") && f.flagValue >= 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 bg-card border border-accent/20 rounded-xl overflow-hidden"
    >
      <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent px-6 py-4 flex items-center justify-between border-b border-accent/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 border border-accent/20 rounded-lg">
            <BookOpen size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-display">Chronicle Progress</p>
            <p className="text-xs text-zinc-400">{completed.length} of {totalChapters} chapters complete</p>
          </div>
        </div>
        <Link href="/story">
          <button className="flex items-center gap-1 text-xs text-accent font-bold hover:underline">
            {current ? "Continue" : "View"}
            <ChevronRight size={14} />
          </button>
        </Link>
      </div>

      <div className="px-6 py-4">
        {/* Progress bar */}
        <div className="w-full h-2 bg-background/50 rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-accent to-primary rounded-full"
          />
        </div>

        {/* Chapter pills */}
        <div className="flex flex-wrap gap-2">
          {chapters.slice(0, 6).map(ch => (
            <div
              key={ch.id}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                ch.isCompleted
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : ch.isUnlocked
                  ? "bg-primary/10 border-primary/30 text-primary animate-pulse"
                  : "bg-zinc-800/50 border-zinc-700/30 text-zinc-500"
              }`}
            >
              {ch.isUnlocked ? null : <Lock size={9} className="inline mr-1" />}
              {ch.title}
            </div>
          ))}
          {chapters.length > 6 && (
            <div className="px-3 py-1 rounded-full text-xs font-bold border bg-zinc-800/50 border-zinc-700/30 text-zinc-500">
              +{chapters.length - 6} more
            </div>
          )}
        </div>

        {/* Unlocked companions from story */}
        {unlockedCompanions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/20">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Earned through story</p>
            <div className="flex flex-wrap gap-2">
              {unlockedCompanions.map(f => (
                <span key={f.flagKey} className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-xs text-primary font-bold">
                  {f.flagKey.replace("companion_unlocked_", "").replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
