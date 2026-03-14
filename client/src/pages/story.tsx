import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams } from "wouter";
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
  battleEnemyKey: string | null;
  battleWinSceneId: number | null;
  battleLoseSceneId: number | null;
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

// ─── Visual maps ───────────────────────────────────────────────────────────

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
  nobunaga_cold:       "bg-red-900 border-red-700",
  nobunaga_smirk:      "bg-red-800 border-red-600",
  nobunaga_fierce:     "bg-red-950 border-red-500",
  nobunaga_intrigued:  "bg-red-900 border-amber-600",
  hayashi_stern:       "bg-stone-700 border-stone-500",
  hayashi_shocked:     "bg-stone-600 border-stone-400",
  mitsuhide_calm:      "bg-blue-900 border-blue-600",
  mitsuhide_resolve:   "bg-blue-800 border-blue-500",
  mitsuhide_approving: "bg-blue-700 border-blue-400",
  mitsuhide_disbelief: "bg-blue-950 border-blue-400",
  mitsuhide_grave:     "bg-blue-950 border-blue-600",
  mitsuhide_grim:      "bg-slate-800 border-blue-600",
  monk_fearful:        "bg-amber-900 border-amber-600",
  scout_panicked:      "bg-green-950 border-green-700",
  kenshin_portrait:    "bg-indigo-900 border-indigo-500",
  messenger_formal:    "bg-stone-800 border-stone-500",
};

const PORTRAIT_INITIALS: Record<string, string> = {
  nobunaga_cold:       "N", nobunaga_smirk:  "N", nobunaga_fierce: "N", nobunaga_intrigued: "N",
  hayashi_stern:       "H", hayashi_shocked: "H",
  mitsuhide_calm:      "M", mitsuhide_resolve: "M", mitsuhide_approving: "M",
  mitsuhide_disbelief: "M", mitsuhide_grave:   "M", mitsuhide_grim: "M",
  monk_fearful:   "Mo", scout_panicked: "Sc",
  kenshin_portrait: "K", messenger_formal: "Me",
};

const FLAG_LABELS: Record<string, string> = {
  ruthlessness:          "⚔ Ruthless",
  political_power:       "⚖ Political",
  mitsuhide_loyalty:     "⚔ Mitsuhide",
  supernatural_affinity: "✦ Supernatural",
  battle_won:            "⚡ Battle Won",
  battle_lost:           "☠ Battle Lost",
};

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
 * FlagBar — shows all flags whose key exists in the flags object.
 * Shows even flags with value === 0 (neutral choices), using \u00b10 display.
 */
function FlagBar({ flags }: { flags: StoryFlags }) {
  const keys = Object.keys(flags);
  if (!keys.length) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {keys.map((k) => {
        const v = flags[k];
        const colour =
          v > 0 ? "bg-green-900/60 border-green-700/60 text-green-300" :
          v < 0 ? "bg-red-900/60 border-red-700/60 text-red-300" :
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

// ─── B2: BattleGateOverlay ──────────────────────────────────────────────────────────
//
// Calls POST /api/battle/field with the locationId derived from the scene's
// battleEnemyKey ("location_3" → 3, falls back to 1).
// On settlement writes an absolute flag (battle_won=1 or battle_lost=1)
// via POST /api/story/flags, then calls onResult(won) to route the scene.

interface BattleGateProps {
  scene: Scene;
  bgGradient: string;
  onResult: (won: boolean, logs: string[]) => void;
}

function BattleGateOverlay({ scene, bgGradient, onResult }: BattleGateProps) {
  const [phase, setPhase]       = useState<"idle" | "fighting" | "done">("idle");
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [won, setWon]           = useState<boolean | null>(null);
  const logRef                  = useRef<HTMLDivElement>(null);

  // Parse locationId from battleEnemyKey: "location_5" -> 5, else 1
  const locationId = (() => {
    if (!scene.battleEnemyKey) return 1;
    const m = scene.battleEnemyKey.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  })();

  const startBattle = useCallback(async () => {
    setPhase("fighting");
    setCombatLogs([]);
    try {
      const res = await fetch("/api/battle/field", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locationId, repeatCount: 1 }),
      });
      const data = await res.json();
      const logs: string[] = data.logs ?? [];
      const victory: boolean = !!data.victory;

      setCombatLogs(logs);
      setWon(victory);
      setPhase("done");

      // Write absolute battle outcome flag to DB
      await fetch("/api/story/flags", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          absolute: {
            battle_won:  victory ? 1 : 0,
            battle_lost: victory ? 0 : 1,
          },
        }),
      });
    } catch (err) {
      setCombatLogs(["Error: could not reach battle server."]);
      setPhase("done");
      setWon(false);
    }
  }, [locationId]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combatLogs]);

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col items-center justify-center p-6`}>
      <div className="w-full max-w-md">
        {/* Header */}
        <p className="text-red-400 text-xs tracking-widest uppercase mb-3 text-center animate-pulse">
          ⚔ Story Battle
        </p>
        <h2 className="text-xl font-bold text-white text-center mb-1">
          {scene.battleEnemyKey?.replace(/_/g, " ") ?? "Battle"}
        </h2>
        <p className="text-stone-400 text-sm text-center mb-5">
          Location {locationId} enemy forces block your path.
        </p>

        {/* Idle state — prompt player */}
        {phase === "idle" && (
          <button
            onClick={startBattle}
            className="w-full py-3 bg-red-800 hover:bg-red-700 text-white font-semibold rounded transition"
          >
            ⚡ Enter Battle
          </button>
        )}

        {/* Fighting — spinner */}
        {phase === "fighting" && (
          <div className="text-center">
            <p className="text-amber-400 text-sm animate-pulse mb-4">Combat in progress…</p>
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Done — result + log */}
        {phase === "done" && won !== null && (
          <div className="space-y-4">
            <div className={`text-center py-3 rounded border ${
              won
                ? "bg-amber-900/40 border-amber-600 text-amber-300"
                : "bg-red-900/40 border-red-700 text-red-300"
            }`}>
              <p className="text-lg font-bold">{won ? "⚡ Victory" : "☠ Defeat"}</p>
              <p className="text-xs mt-1 text-white/50">
                {won ? "Press below to continue your story." : "You may retry or accept defeat."}
              </p>
            </div>

            {/* Scrollable combat log */}
            <div
              ref={logRef}
              className="bg-black/50 border border-white/10 rounded p-3 max-h-48 overflow-y-auto text-xs
                text-stone-300 space-y-0.5 font-mono"
            >
              {combatLogs.map((l, i) => (
                <p key={i} className={l.startsWith("---") ? "text-white/40 text-center" : ""}>{l}</p>
              ))}
            </div>

            <div className="flex gap-3">
              {!won && (
                <button
                  onClick={() => { setPhase("idle"); setWon(null); setCombatLogs([]); }}
                  className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 text-white text-sm rounded transition"
                >
                  ↺ Retry
                </button>
              )}
              <button
                onClick={() => onResult(won, combatLogs)}
                className={`flex-1 py-2 text-white text-sm rounded transition ${
                  won
                    ? "bg-amber-700 hover:bg-amber-600"
                    : "bg-zinc-700 hover:bg-zinc-600"
                }`}
              >
                {won ? "→ Continue Story" : "→ Accept Defeat"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────────

export default function StoryPage() {
  // Read chapterId from URL: /story/:chapterId (falls back to 1 for the root /story route)
  const params = useParams<{ chapterId?: string }>();
  const CHAPTER_ID = params.chapterId ? parseInt(params.chapterId, 10) : 1;

  const [chapter, setChapter]         = useState<ChapterData | null>(null);
  const [sceneId, setSceneId]         = useState<number | null>(null);
  const [lineIndex, setLineIndex]     = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [isComplete, setIsComplete]   = useState(false);
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

  // Derive battle-gate state directly from scene (no separate boolean state)
  const isBattleGate = !!scene?.isBattleGate && !showChoices;
  const isAtLastLine = !!scene && lineIndex >= scene.dialogueLines.length - 1;
  const battleReady  = isBattleGate && isAtLastLine && !isTyping;

  // ── Boot: fetch chapter + resume progress ───────────────────────────────
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

        if (
          progress &&
          progress.chapterId === CHAPTER_ID &&
          !progress.isCompleted &&
          progress.currentSceneId
        ) {
          setSceneId(progress.currentSceneId);
        } else {
          await startChapter(CHAPTER_ID, firstId);
          setSceneId(firstId);
          setFlags(await getFlags());
        }
      } catch {
        setError("Failed to load chapter. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [CHAPTER_ID]);

  // ── Typewriter ──────────────────────────────────────────────────────────────
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

  // ── Mark scene seen ───────────────────────────────────────────────────────────
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

    // If there are choices, reveal them (battle-gate is handled by overlay)
    if (scene.choices.length > 0) { setShowChoices(true); return; }

    // If this is a battle-gate, stop here — BattleGateOverlay takes over on next render
    if (scene.isBattleGate) return;

    if (scene.isChapterEnd) {
      await completeChapter();
      await unlockEnding({
        chapterId: CHAPTER_ID,
        endingKey: `ch${CHAPTER_ID}_complete`,
        endingTitle: chapter.title,
        endingDescription: `Chapter ${CHAPTER_ID} complete.`,
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
  }, [scene, chapter, lineIndex, isTyping, skipTypewriter, CHAPTER_ID]);

  const handleChoice = useCallback(async (choice: Choice) => {
    if (!scene) return;
    const mutations: StoryFlags = {};
    if (choice.flagKey != null) mutations[choice.flagKey] = choice.flagValue ?? 0;
    if (choice.flagKey2 != null && choice.flagValue2 != null) mutations[choice.flagKey2] = choice.flagValue2;
    const updated = await applyFlags(mutations);
    setFlags(updated);
    await advanceScene(choice.nextSceneId);
    setSceneId(choice.nextSceneId);
    setLineIndex(0);
    setShowChoices(false);
  }, [scene]);

  // B2: called by BattleGateOverlay after combat + flag write
  const handleBattleResult = useCallback(async (won: boolean, _logs: string[]) => {
    if (!scene) return;
    const nextId = won
      ? (scene.battleWinSceneId ?? scene.nextSceneId)
      : (scene.battleLoseSceneId ?? scene.nextSceneId);
    if (!nextId) return;
    // Refresh flags from server so FlagBar reflects battle_won/battle_lost
    setFlags(await getFlags());
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
    setFlags({});
  }, [chapter, CHAPTER_ID]);

  // ── Loading / error screens ─────────────────────────────────────────────────
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

  // ── Chapter complete ─────────────────────────────────────────────────────
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

  // ── B2: Battle gate ──────────────────────────────────────────────────────────
  // Show BattleGateOverlay once all dialogue on a battle-gate scene is read
  if (battleReady) {
    return (
      <BattleGateOverlay
        scene={scene}
        bgGradient={bgGradient}
        onResult={handleBattleResult}
      />
    );
  }

  // ── Main VN layout ──────────────────────────────────────────────────────────
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
          Ch.{CHAPTER_ID} · {chapter.title}
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

        {/* Battle gate prompt (shown while reading dialogue on a battle scene) */}
        {scene.isBattleGate && isAtLastLine && !isTyping && (
          <p className="text-right text-red-500/70 text-xs mt-2 animate-pulse">tap to enter battle ⚔</p>
        )}

        {!showChoices && !isTyping && !scene.isBattleGate && (
          <p className="text-right text-stone-600 text-xs mt-2 animate-pulse">tap to continue ▸</p>
        )}
      </div>
    </div>
  );
}
