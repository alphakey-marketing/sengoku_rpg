/**
 * ChapterSelectHub.tsx
 * Renders the chapter-selection list. Locked chapters are shown but
 * not clickable; completed chapters show a ✓ badge.
 */
import { useLocation } from "wouter";
import {
  CHAPTER_CATALOGUE,
  CHAPTER_COMPLETE_DESTINATION,
} from "@/lib/story-constants";

export interface ChapterSelectHubProps {
  currentChapter: number;
  onSelectChapter: (id: number) => void;
}

export function ChapterSelectHub({ currentChapter, onSelectChapter }: ChapterSelectHubProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-zinc-900 to-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 bg-black/40 backdrop-blur-sm border-b border-white/5">
        <button
          onClick={() => navigate("/")}
          className="text-stone-400 hover:text-white text-xs transition"
        >
          ← Dojo
        </button>
        <span className="text-stone-400 text-xs tracking-widest uppercase">Chronicles</span>
        <div className="w-16" />
      </div>

      <div className="px-6 pt-8 pb-4">
        <p className="text-amber-400 text-xs tracking-widest uppercase mb-2">Sengoku Chronicles</p>
        <h1 className="text-2xl font-bold text-white mb-1">Story Chapters</h1>
        <p className="text-stone-400 text-sm">
          Your legacy is forged through choice. Each chapter unlocks new areas of your domain.
        </p>
      </div>

      <div className="flex-1 px-5 pb-8 space-y-3 overflow-y-auto">
        {CHAPTER_CATALOGUE.map((ch) => {
          const isCompleted = ch.id <= currentChapter;
          const canPlay = ch.available && (
            ch.id === 1 ||
            ch.id <= currentChapter ||
            ch.id === currentChapter + 1
          );

          return (
            <div
              key={ch.id}
              onClick={() => canPlay && onSelectChapter(ch.id)}
              className={`relative rounded-lg border p-4 transition-all ${
                canPlay
                  ? "border-amber-700/40 bg-amber-900/10 hover:bg-amber-900/20 cursor-pointer"
                  : "border-white/5 bg-white/[0.03] cursor-not-allowed opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border flex-shrink-0 ${
                    isCompleted
                      ? "bg-amber-800/60 border-amber-600/60 text-amber-300"
                      : canPlay
                      ? "bg-stone-800 border-stone-600 text-white"
                      : "bg-stone-900 border-stone-700 text-stone-600"
                  }`}>
                    {isCompleted ? "✓" : ch.id}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${canPlay ? "text-white" : "text-stone-600"}`}>
                      {ch.title}
                    </p>
                    <p className={`text-xs mt-0.5 ${canPlay ? "text-stone-400" : "text-stone-700"}`}>
                      {ch.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  {isCompleted ? (
                    <span className="text-xs text-amber-500 border border-amber-700/40 px-2 py-0.5 rounded-full">
                      Completed
                    </span>
                  ) : canPlay ? (
                    <span className="text-xs text-green-400 border border-green-700/40 px-2 py-0.5 rounded-full animate-pulse">
                      ▶ Play
                    </span>
                  ) : (
                    <span className="text-xs text-stone-600 border border-stone-800 px-2 py-0.5 rounded-full">
                      🔒 Locked
                    </span>
                  )}
                </div>
              </div>

              {canPlay && CHAPTER_COMPLETE_DESTINATION[ch.id] && (
                <p className="text-[10px] text-stone-500 mt-2 pl-12">
                  Completes → unlocks {CHAPTER_COMPLETE_DESTINATION[ch.id].label}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
