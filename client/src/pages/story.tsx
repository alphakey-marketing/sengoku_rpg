import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
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
  type ProgressState,
  type StoryFlags,
} from "@/lib/story-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DialogueLine {
  id: number;
  speakerName: string;
  speakerSide: "left" | "right" | "none";
  portraitKey: string | null;
  text: string;
  lineOrder: number;
}

interface Choice {
  id: number;
  choiceText: string;
  nextSceneId: number;
  flagKey: string | null;
  flagValue: number | null;
  flagKey2: string | null;
  flagValue2: number | null;
  choiceOrder: number;
}

interface Scene {
  id: number;
  sceneOrder: number;
  backgroundKey: string;
  bgmKey: string;
  nextSceneId: number | null;
  isBattleGate: boolean;
  battleEnemyKey?: string | null;
  battleWinSceneId?: number | null;
  battleLoseSceneId?: number | null;
  isChapterEnd: boolean;
  dialogueLines: DialogueLine[];
  choices: Choice[];
}

interface ChapterData {
  id: number;
  title: string;
  subtitle: string | null;
  firstSceneId: number | null;
  isLocked: boolean;
  scenes: Scene[];
}

// ─── Visual maps ──────────────────────────────────────────────────────────────

const BG_MAP: Record<string, string> = {
  owari_province_dawn:       "from-amber-950 via-orange-900 to-stone-900",
  owari_castle_interior:     "from-stone-950 via-stone-900 to-zinc-900",
  owari_castle_exterior:     "from-slate-900 via-stone-900 to-zinc-950",
  owari_road_afternoon:      "from-yellow-950 via-amber-900 to-stone-900",
  nagashino_ruins_dusk:      "from-purple-950 via-slate-900 to-stone-950",
  owari_castle_armory_night: "from-zinc-950 via-slate-950 to-black",
  nagashino_ruins_ash:       "from-gray-800 via-stone-900 to-zinc-950",
  owari_border_storm:        "from-slate-800 via-blue-950 to-stone-950",
  okehazama_gorge_storm:     "from-blue-950 via-slate-900 to-black",
  okehazama_aftermath_dawn:  "from-orange-950 via-amber-900 to-stone-950",
  owari_castle_night_rain:   "from-slate-950 via-blue-950 to-black",
  owari_castle_night:        "from-zinc-950 via-slate-950 to-black",
  default:                   "from-stone-950 via-zinc-900 to-black",
};

const PORTRAIT_COLOURS: Record<string, string> = {
  nobunaga_cold: "bg-red-900 border-red-700", nobunaga_smirk: "bg-red-800 border-red-600",
  nobunaga_fierce: "bg-red-950 border-red-500", nobunaga_intrigued: "bg-red-900 border-amber-600",
  hayashi_stern: "bg-stone-700 border-stone-500", hayashi_shocked: "bg-stone-600 border-stone-400",
  mitsuhide_calm: "bg-blue-900 border-blue-600", mitsuhide_resolve: "bg-blue-800 border-blue-500",
  mitsuhide_approving: "bg-blue-700 border-blue-400", mitsuhide_disbelief: "bg-blue-950 border-blue-400",
  mitsuhide_grave: "bg-blue-950 border-blue-600", mitsuhide_grim: "bg-slate-800 border-blue-600",
  monk_fearful: "bg-amber-900 border-amber-600", scout_panicked: "bg-green-950 border-green-700",
  kenshin_portrait: "bg-indigo-900 border-indigo-500", messenger_formal: "bg-stone-800 border-stone-500",
};

const PORTRAIT_INITIALS: Record<string, string> = {
  nobunaga_cold: "N", nobunaga_smirk: "N", nobunaga_fierce: "N", nobunaga_intrigued: "N",
  hayashi_stern: "H", hayashi_shocked: "H",
  mitsuhide_calm: "M", mitsuhide_resolve: "M", mitsuhide_approving: "M",
  mitsuhide_disbelief: "M", mitsuhide_grave: "M", mitsuhide_grim: "M",
  monk_fearful: "Mo", scout_panicked: "Sc",
  kenshin_portrait: "K", messenger_formal: "Me",
};

const FLAG_LABELS: Record<string, string> = {
  ruthlessness:         "⚔ Ruthless",
  political_power:      "⚖ Political",
  mitsuhide_loyalty:    "⚔ Mitsuhide",
  supernatural_affinity: "✦ Supernatural",
};

const CHAPTER_ID = 1;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Portrait({ portraitKey, side }: { portraitKey: string | null; side: "left" | "right" }) {
  if (!portraitKey) return <div className="w-28 h-36 md:w-32 md:h-44" />;
  const colours  = PORTRAIT_COLOURS[portraitKey] ?? "bg-stone-700 border-stone-500";
  const initials = PORTRAIT_INITIALS[portraitKey] ?? "?";
  const flip = side === "right" ? "scale-x-[-1]" : "";
  return (
    <div className={`w-28 h-36 md:w-32 md:h-44 rounded-sm border-2 ${colours} ${flip}
      flex items-end justify-center pb-1 shadow-lg flex-shrink-0 transition-all duration-300`}>
      <span className={`text-2xl font-bold text-white/60 ${flip}`}>{initials}</span>
    </div>
  );
}

/**
 * FlagBar — shows all flags that have been touched by a choice.
 *
 * FIX: The original filter `v !== 0` hid flags with a 0 score, making it
 * look like nothing changed when a neutral choice was made (e.g. "Prove
 * yourself first" sets mitsuhide_loyalty to 0). Now we show all flags
 * whose key exists in the flags object (i.e. has been written at least
 * once), using `Object.keys` instead of filtering by value.
 * Score display: positive → green+, negative → red−, zero → grey ±0.
 */
function FlagBar({ flags }: { flags: StoryFlags }) {
  const keys = Object.keys(flags);
  if (!keys.length) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {keys.map((k) => {
        const v = flags[k];
        const colour =
          v > 0  ? "bg-green-900/60 border-green-700/60 text-green-300" :
          v < 0  ? "bg-red-900/60 border-red-700/60 text-red-300" :
                   "bg-white/10 border-white/20 text-white/50";
        const display = v > 0 ? `+${v}` : v === 0 ? "±0" : `${v}`;
        return (
          <span key={k} className={`text-xs px-2 py-0.5 rounded-full border ${colour}`}>
            {FLAG_LABELS[k] ?? k} {display}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryPage() {
  const [chapter, setChapter]         = useState<ChapterData | null>(null);
  const [sceneId, setSceneId]         = useState<number | null>(null);
  const [lineIndex, setLineIndex]     = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [isComplete, setIsComplete]   = useState(false);
  const [isBattleGate, setIsBattleGate] = useState(false);
  const [flags, setFlags]             = useState<StoryFlags>({});
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sceneMap = chapter
    ? Object.fromEntries(chapter.scenes.map((s) => [s.id, s]))
    : {};
  const scene       = sceneId ? sceneMap[sceneId] ?? null : null;
  const currentLine = scene?.dialogueLines[lineIndex] ?? null;

  // ── Boot: fetch chapter + resume progress ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [chapterData, savedFlags, progress] = await Promise.all([
          fetchChapter(CHAPTER_ID),
          getFlags(),
          getProgress(),
        ]);
        setChapter(chapterData);
        setFlags(savedFlags);

        const firstId = chapterData.firstSceneId ?? chapterData.scenes[0]?.id;

        if (progress && progress.chapterId === CHAPTER_ID && !progress.isCompleted && progress.currentSceneId) {
          // Resume mid-chapter — flags are already correct from localStorage
          setSceneId(progress.currentSceneId);
        } else {
          // Fresh start — startChapter clears stale flags (Bug 1 fix)
          await startChapter(CHAPTER_ID, firstId);
          setSceneId(firstId);
          // Re-read flags after clear so FlagBar starts empty
          setFlags(await getFlags());
        }
      } catch (e) {
        setError("Failed to load chapter. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  // ── Mark scene seen ────────────────────────────────────────────────────────
  useEffect(() => {
    if (scene) markSceneSeen(scene.sceneOrder);
  }, [sceneId]);

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

    const nextLineIdx = lineIndex + 1;
    if (nextLineIdx < scene.dialogueLines.length) { setLineIndex(nextLineIdx); return; }

    if (scene.choices.length > 0) { setShowChoices(true); return; }

    if (scene.isBattleGate) { setIsBattleGate(true); return; }

    if (scene.isChapterEnd) {
      await completeChapter();
      await unlockEnding({
        chapterId: CHAPTER_ID,
        endingKey: "ch1_complete",
        endingTitle: "The Fool of Owari",
        endingDescription: "Chapter 1 complete. Japan watches.",
      });
      setIsComplete(true);
      return;
    }

    if (scene.nextSceneId) {
      await advanceScene(scene.nextSceneId);
      setSceneId(scene.nextSceneId);
      setLineIndex(0);
      setShowChoices(false);
    }
  }, [scene, chapter, lineIndex, isTyping, skipTypewriter]);

  const handleChoice = useCallback(async (choice: Choice) => {
    if (!scene) return;
    const mutations: StoryFlags = {};
    if (choice.flagKey !== null && choice.flagKey !== undefined) {
      // Always record the flag key, even for flagValue === 0 (neutral choices).
      // This ensures the FlagBar shows the flag was touched (Bug 2 fix).
      mutations[choice.flagKey] = choice.flagValue ?? 0;
    }
    if (choice.flagKey2 !== null && choice.flagKey2 !== undefined && choice.flagValue2 !== null) {
      mutations[choice.flagKey2] = choice.flagValue2 ?? 0;
    }
    // Always call applyFlags so the flag key is written even for value 0
    const updated = await applyFlags(mutations);
    setFlags(updated);

    await advanceScene(choice.nextSceneId);
    setSceneId(choice.nextSceneId);
    setLineIndex(0);
    setShowChoices(false);
  }, [scene]);

  const handleBattleResult = useCallback(async (won: boolean) => {
    if (!scene) return;
    const nextId = won ? scene.battleWinSceneId! : scene.battleLoseSceneId!;
    setIsBattleGate(false);
    await advanceScene(nextId);
    setSceneId(nextId);
    setLineIndex(0);
    setShowChoices(false);
  }, [scene]);

  const handleReset = useCallback(async () => {
    if (!chapter) return;
    await resetStory();
    const firstId = chapter.firstSceneId ?? chapter.scenes[0]?.id;
    await startChapter(CHAPTER_ID, firstId, true);
    setSceneId(firstId);
    setLineIndex(0);
    setShowChoices(false);
    setIsComplete(false);
    setIsBattleGate(false);
    // Reset flags state so FlagBar clears immediately on replay
    setFlags({});
  }, [chapter]);

  // ── Loading / error screens ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading chapter…</p>
      </div>
    );
  }
  if (error || !chapter || !scene) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? "Scene not found."}</p>
      </div>
    );
  }

  const bgGradient    = BG_MAP[scene.backgroundKey] ?? BG_MAP.default;
  const leftPortrait  = currentLine?.speakerSide === "left"  ? currentLine.portraitKey : null;
  const rightPortrait = currentLine?.speakerSide === "right" ? currentLine.portraitKey : null;

  // ── Chapter complete ───────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-lg">
          <p className="text-amber-400 text-sm tracking-widest uppercase mb-4">Chapter Complete</p>
          <h1 className="text-3xl font-bold text-white mb-2">{chapter.title}</h1>
          <p className="text-stone-400 italic mb-8">{chapter.subtitle}</p>
          <div className="mb-8 p-4 bg-white/5 rounded border border-white/10">
            <p className="text-stone-300 text-sm mb-3">Your story so far:</p>
            <FlagBar flags={flags} />
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={handleReset}
              className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition">
              ↺ Replay Chapter
            </button>
            <Link href="/map">
              <button className="px-5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm transition">
                → Campaign Map
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Battle gate ────────────────────────────────────────────────────────────
  if (isBattleGate) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col items-center justify-center p-8 text-center`}>
        <div className="max-w-md">
          <p className="text-red-400 text-xs tracking-widest uppercase mb-4 animate-pulse">⚔ Battle</p>
          <h2 className="text-2xl font-bold text-white mb-2">Battle of Okehazama</h2>
          <p className="text-stone-400 text-sm mb-8">Imagawa Vanguard stands before you.</p>
          <p className="text-stone-500 text-xs mb-6 italic">
            Full battle integration wires into the existing combat engine.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => handleBattleResult(true)}
              className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded font-semibold transition">
              ⚡ Victory
            </button>
            <button onClick={() => handleBattleResult(false)}
              className="px-6 py-3 bg-stone-700 hover:bg-stone-600 text-white rounded font-semibold transition">
              ✕ Defeat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main VN layout ─────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col select-none`}
      onClick={!showChoices ? advance : undefined}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm">
        <Link href="/map">
          <span className="text-stone-400 hover:text-white text-xs transition cursor-pointer">← Map</span>
        </Link>
        <span className="text-stone-500 text-xs tracking-widest uppercase">
          Chapter {CHAPTER_ID} · {chapter.title}
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

      {/* Portrait stage */}
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

      {/* Dialogue box */}
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

        {/* Choices */}
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

        {!showChoices && !isTyping && (
          <p className="text-right text-stone-600 text-xs mt-2 animate-pulse">tap to continue ▸</p>
        )}
      </div>
    </div>
  );
}
