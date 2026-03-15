/**
 * StoryPlayer.tsx
 * Core scene renderer: typewriter dialogue, portrait display,
 * choice branching, battle-gate hand-off, and chapter completion.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import {
  startChapter,
  advanceScene,
  completeChapter,
  markSceneSeen,
  applyFlags,
  unlockEnding,
  getProgress,
  getFlags,
  resetStory,
  fetchChapter,
  type StoryFlags,
  type Choice,
  type Scene,
  type ChapterData,
} from "@/lib/story-engine";
import { BG_MAP, CHAPTER_COMPLETE_DESTINATION, CHAPTER_CATALOGUE } from "@/lib/story-constants";
import { Portrait } from "./Portrait";
import { FlagBar }  from "./FlagBar";
import { BattleGateOverlay } from "./BattleGateOverlay";

export interface StoryPlayerProps {
  chapterId: number;
}

export function StoryPlayer({ chapterId }: StoryPlayerProps) {
  const [, navigate] = useLocation();

  const [chapter, setChapter]             = useState<ChapterData | null>(null);
  const [sceneId, setSceneId]             = useState<number | null>(null);
  const [lineIndex, setLineIndex]         = useState(0);
  const [showChoices, setShowChoices]     = useState(false);
  const [isComplete, setIsComplete]       = useState(false);
  const [flags, setFlags]                 = useState<StoryFlags>({});
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping]           = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [comingSoon, setComingSoon]       = useState(false);
  const [advanceError, setAdvanceError]   = useState<string | null>(null);
  const typeTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionFiredRef = useRef(false);

  const sceneMap = chapter
    ? Object.fromEntries(chapter.scenes.map((s) => [s.id, s]))
    : {};
  const scene       = sceneId ? sceneMap[sceneId] ?? null : null;
  const currentLine = scene?.dialogueLines[lineIndex] ?? null;

  const isAtLastLine = !!scene && lineIndex >= scene.dialogueLines.length - 1;
  const battleReady  = !!scene?.isBattleGate && !showChoices && isAtLastLine && !isTyping;

  const completionDest = CHAPTER_COMPLETE_DESTINATION[chapterId]
    ?? { path: "/story", label: "Return to Chronicles" };
  const catalogueEntry = CHAPTER_CATALOGUE.find((c) => c.id === chapterId);

  // ── triggerCompletion ──────────────────────────────────────────────────────
  const triggerCompletion = useCallback(async () => {
    if (completionFiredRef.current || !chapter) return;
    completionFiredRef.current = true;
    try {
      const finalFlags = await getFlags();
      if (Object.keys(finalFlags).length > 0) {
        apiRequest("POST", "/api/story/flags", { absolute: finalFlags }).catch(() => {});
      }
      await apiRequest("POST", "/api/story/progress/complete", {
        chapterId,
        endingKey:         `ch${chapterId}_complete`,
        endingTitle:       chapter.title,
        endingDescription: `Chapter ${chapterId} complete.`,
      });
      await completeChapter();
      await unlockEnding({
        chapterId,
        endingKey:         `ch${chapterId}_complete`,
        endingTitle:       chapter.title,
        endingDescription: `Chapter ${chapterId} complete.`,
      });
      await queryClient.refetchQueries({ queryKey: [api.player.get.path] });
      setIsComplete(true);
    } catch {
      completionFiredRef.current = false;
      setIsComplete(true);
    }
  }, [chapter, chapterId]);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setComingSoon(false);
        setError(null);
        const [chapterData, savedFlags, progress] = await Promise.all([
          fetchChapter(chapterId),
          getFlags(),
          getProgress(),
        ]);
        setChapter(chapterData);
        setFlags(savedFlags);
        const firstId = chapterData.firstSceneId ?? chapterData.scenes[0]?.id;

        if (progress && progress.chapterId === chapterId) {
          if (progress.isCompleted) {
            completionFiredRef.current = true;
            setSceneId(progress.currentSceneId ?? firstId);
            setIsComplete(true);
          } else if (progress.currentSceneId) {
            setSceneId(progress.currentSceneId);
          } else {
            await startChapter(chapterId, firstId);
            setSceneId(firstId);
            setFlags(await getFlags());
          }
        } else {
          await startChapter(chapterId, firstId);
          setSceneId(firstId);
          setFlags(await getFlags());
        }
      } catch (err: any) {
        const msg: string = err?.message ?? String(err);
        if (msg.toLowerCase().includes("not yet available") || msg.toLowerCase().includes("not available")) {
          setComingSoon(true);
        } else {
          setError("Failed to load chapter. Please refresh.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterId]);

  // ── Typewriter ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentLine) return;
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    const full = currentLine.text;
    let i = 0;
    setDisplayedText("");
    setIsTyping(true);
    const tick = () => {
      i++;
      setDisplayedText(full.slice(0, i));
      if (i < full.length) { typeTimerRef.current = setTimeout(tick, 22); }
      else { setIsTyping(false); }
    };
    typeTimerRef.current = setTimeout(tick, 22);
    return () => { if (typeTimerRef.current) clearTimeout(typeTimerRef.current); };
  }, [sceneId, lineIndex]);

  useEffect(() => {
    if (scene) markSceneSeen(scene.sceneOrder);
  }, [sceneId]);

  // ── Declarative completion fallback ───────────────────────────────────────
  useEffect(() => {
    if (scene?.isChapterEnd && isAtLastLine && !isTyping && !showChoices && !isComplete && !completionFiredRef.current) {
      triggerCompletion();
    }
  }, [scene, isAtLastLine, isTyping, showChoices, isComplete, triggerCompletion]);

  const skipTypewriter = useCallback(() => {
    if (isTyping && currentLine) {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
      setDisplayedText(currentLine.text);
      setIsTyping(false);
    }
  }, [isTyping, currentLine]);

  const advance = useCallback(async () => {
    if (!scene || !chapter) return;
    if (isTyping) { skipTypewriter(); return; }
    setAdvanceError(null);
    const nextLineIdx = lineIndex + 1;
    if (nextLineIdx < scene.dialogueLines.length) { setLineIndex(nextLineIdx); return; }
    if (scene.choices.length > 0) { setShowChoices(true); return; }
    if (scene.isBattleGate) return;
    if (scene.isChapterEnd) { await triggerCompletion(); return; }
    if (scene.nextSceneId) {
      const nextId = scene.nextSceneId;
      setSceneId(nextId);
      setLineIndex(0);
      setShowChoices(false);
      advanceScene(nextId).catch((err: any) => {
        console.warn("[story] advanceScene server error (non-blocking):", err?.message ?? err);
        setAdvanceError("⚠ sync error — tap again if needed");
        setTimeout(() => setAdvanceError(null), 3000);
      });
    }
  }, [scene, chapter, lineIndex, isTyping, skipTypewriter, triggerCompletion]);

  const handleChoice = useCallback(async (choice: Choice) => {
    if (!scene) return;
    const mutations: StoryFlags = {};
    if (choice.flagKey != null) mutations[choice.flagKey] = choice.flagValue ?? 0;
    if (choice.flagKey2 != null && choice.flagValue2 != null) mutations[choice.flagKey2] = choice.flagValue2;

    const optimistic = { ...flags };
    for (const [k, v] of Object.entries(mutations)) optimistic[k] = (optimistic[k] ?? 0) + v;
    setFlags(optimistic);

    applyFlags(mutations).catch((err: any) => {
      console.warn("[story] applyFlags error (non-blocking):", err?.message ?? err);
    });
    if (Object.keys(mutations).length > 0) {
      apiRequest("POST", "/api/story/flags", { mutations }).catch(() => {});
    }

    setSceneId(choice.nextSceneId);
    setLineIndex(0);
    setShowChoices(false);
    advanceScene(choice.nextSceneId).catch((err: any) => {
      console.warn("[story] advanceScene (choice) server error (non-blocking):", err?.message ?? err);
    });
  }, [scene, flags]);

  const handleBattleResult = useCallback(async (won: boolean, _logs: string[]) => {
    if (!scene) return;
    try {
      const result = await apiRequest("POST", "/api/story/battle-result", {
        sceneId: scene.id,
        battleResult: won ? "win" : "lose",
      });
      const nextId: number | null = result?.nextSceneId ?? null;
      if (!nextId) return;
      let latestFlags = flags;
      try { latestFlags = await getFlags(); } catch {}
      setFlags(latestFlags);
      setSceneId(nextId);
      setLineIndex(0);
      setShowChoices(false);
      advanceScene(nextId).catch((err: any) => {
        console.warn("[story] advanceScene (battle) server error (non-blocking):", err?.message ?? err);
      });
    } catch (err: any) {
      console.warn("[story] handleBattleResult error:", err?.message ?? err);
      const nextId = won
        ? (scene.battleWinSceneId ?? scene.nextSceneId)
        : (scene.battleLoseSceneId ?? scene.nextSceneId);
      if (!nextId) return;
      setSceneId(nextId);
      setLineIndex(0);
      setShowChoices(false);
    }
  }, [scene, flags]);

  const handleReset = useCallback(async () => {
    if (!chapter) return;
    completionFiredRef.current = false;
    await resetStory();
    const firstId = chapter.firstSceneId ?? chapter.scenes[0]?.id;
    await startChapter(chapterId, firstId, true);
    setSceneId(firstId);
    setLineIndex(0);
    setShowChoices(false);
    setIsComplete(false);
    setFlags({});
  }, [chapter, chapterId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading chapter…</p>
      </div>
    );
  }

  if (comingSoon) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 via-zinc-900 to-black flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <p className="text-amber-400 text-xs tracking-widest uppercase mb-4">Coming Soon</p>
          <h1 className="text-2xl font-bold text-white mb-2">
            Chapter {chapterId}{catalogueEntry ? `: ${catalogueEntry.title}` : ""}
          </h1>
          {catalogueEntry && (
            <p className="text-stone-400 italic mb-6">{catalogueEntry.subtitle}</p>
          )}
          <div className="mb-8 p-4 bg-white/5 rounded border border-white/10">
            <p className="text-stone-400 text-sm">
              This chapter is still being written. The Sengoku chronicle continues — check back soon.
            </p>
          </div>
          <button onClick={() => navigate("/story")} className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition">
            ← Back to Chronicles
          </button>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-400 text-sm">{error ?? "Chapter not found."}</p>
        <button onClick={() => navigate("/story")} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-sm rounded transition">
          ← Back to Chronicles
        </button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-lg">
          <p className="text-amber-400 text-sm tracking-widest uppercase mb-4">Chapter Complete</p>
          <h1 className="text-3xl font-bold text-white mb-2">{chapter.title}</h1>
          <p className="text-stone-400 italic mb-8">{chapter.subtitle}</p>
          <div className="mb-8 p-4 bg-white/5 rounded border border-white/10">
            <p className="text-stone-300 text-sm mb-3">Your legacy choices:</p>
            <FlagBar flags={flags} />
          </div>
          <div className="mb-8 p-4 bg-amber-900/20 rounded border border-amber-700/30 text-left">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-1">★ New area unlocked</p>
            <p className="text-white text-sm font-semibold">{completionDest.label}</p>
            <p className="text-stone-400 text-xs mt-1">
              {chapterId === 1 && "Your Dojo is now open — review your stats and spend your first stat points."}
              {chapterId === 2 && "The War Council opens — recruit companions and build your party."}
              {chapterId === 3 && "The Armoury is unlocked — equip and upgrade the loot you've earned."}
              {chapterId === 4 && "The Shrine awaits — summon new warriors with the Gacha."}
              {chapterId === 5 && "The Menagerie is open — tame and equip spirit beasts."}
              {chapterId === 6 && "The Stables are ready — mount your war horses."}
              {chapterId === 7 && "The Campaign Map is open — lead your armies across Japan."}
              {chapterId === 8 && "The chronicle is complete. Your legacy is written."}
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={handleReset} className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition">
              ↺ Replay Chapter
            </button>
            <button onClick={() => navigate(completionDest.path)} className="px-5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm font-semibold transition">
              → {completionDest.label}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-400 text-sm">Scene not found.</p>
      </div>
    );
  }

  const bgGradient    = BG_MAP[scene.backgroundKey] ?? BG_MAP.default;
  const leftPortrait  = currentLine?.speakerSide === "left"  ? currentLine.portraitKey : null;
  const rightPortrait = currentLine?.speakerSide === "right" ? currentLine.portraitKey : null;

  if (battleReady) {
    return <BattleGateOverlay scene={scene} bgGradient={bgGradient} onResult={handleBattleResult} />;
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col select-none`}
      onClick={!showChoices ? advance : undefined}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm">
        <button
          onClick={(e) => { e.stopPropagation(); navigate("/story"); }}
          className="text-stone-400 hover:text-white text-xs transition cursor-pointer"
        >
          ← Chapters
        </button>
        <span className="text-stone-500 text-xs tracking-widest uppercase">
          Ch.{chapterId} · {chapter.title}
        </span>
        <div className="flex gap-2 items-center">
          <FlagBar flags={flags} />
          <button
            onClick={(e) => { e.stopPropagation(); handleReset(); }}
            className="text-stone-600 hover:text-stone-400 text-xs ml-2 transition"
            title="Restart chapter"
          >
            ↺
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between px-6 pb-2 pointer-events-none">
        <div className={`transition-all duration-300 ${
          leftPortrait ? "opacity-100 translate-y-0" : "opacity-30 translate-y-2"
        }`}>
          <Portrait portraitKey={leftPortrait} side="left" />
        </div>
        <div className={`transition-all duration-300 ${
          rightPortrait ? "opacity-100 translate-y-0" : "opacity-30 translate-y-2"
        }`}>
          <Portrait portraitKey={rightPortrait} side="right" />
        </div>
      </div>

      <div className="mx-3 mb-3 rounded bg-black/70 backdrop-blur border border-white/10 p-4 min-h-[130px] flex flex-col justify-between">
        <div>
          {currentLine && (
            <>
              {currentLine.speakerName !== "Narrator" && (
                <p className="text-amber-400 text-xs font-semibold tracking-wide mb-1">
                  {currentLine.speakerName}
                </p>
              )}
              <p className={`text-sm leading-relaxed ${
                currentLine.speakerName === "Narrator" ? "text-stone-300 italic" : "text-white"
              }`}>
                {displayedText}
                {isTyping && <span className="animate-pulse">▌</span>}
              </p>
            </>
          )}
        </div>

        {showChoices && scene.choices.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {[...scene.choices]
              .sort((a, b) => a.choiceOrder - b.choiceOrder)
              .map((c, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); handleChoice(c); }}
                  className="text-left text-sm text-white bg-white/5 hover:bg-white/15
                    border border-white/10 hover:border-amber-500/50 rounded px-3 py-2
                    transition-all duration-150 cursor-pointer"
                >
                  {c.choiceText}
                </button>
              ))}
          </div>
        )}

        {scene.isBattleGate && isAtLastLine && !isTyping && (
          <p className="text-right text-red-500/70 text-xs mt-2 animate-pulse">tap to enter battle ⚔</p>
        )}
        {!showChoices && !isTyping && !scene.isBattleGate && !scene.isChapterEnd && (
          <p className="text-right text-stone-600 text-xs mt-2 animate-pulse">
            {advanceError ?? "tap to continue ▸"}
          </p>
        )}
        {scene.isChapterEnd && isAtLastLine && !isTyping && (
          <p className="text-right text-amber-600/70 text-xs mt-2 animate-pulse">tap to complete chapter ★</p>
        )}
      </div>
    </div>
  );
}
