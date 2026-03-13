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
  listChapters,
  type ProgressState,
  type StoryFlags,
  type ChapterSummary,
  type UnlockedCompanion,
} from "@/lib/story-engine";
import { BookOpen, Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────────────────

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

// ─── Rarity colour map ──────────────────────────────────────────────────────────────

const RARITY_COLOURS: Record<string, { pill: string; border: string; glow: string }> = {
  legendary:    { pill: "bg-amber-500/20 text-amber-300 border-amber-500/50",   border: "border-amber-500/60",  glow: "shadow-[0_0_20px_rgba(245,158,11,0.35)]" },
  epic:         { pill: "bg-purple-500/20 text-purple-300 border-purple-500/50", border: "border-purple-500/60", glow: "shadow-[0_0_20px_rgba(168,85,247,0.35)]" },
  gold:         { pill: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50", border: "border-yellow-500/60", glow: "shadow-[0_0_15px_rgba(234,179,8,0.25)]"  },
  mythic:       { pill: "bg-pink-500/20 text-pink-300 border-pink-500/50",       border: "border-pink-500/60",   glow: "shadow-[0_0_15px_rgba(236,72,153,0.25)]" },
  transcendent: { pill: "bg-white/10 text-white border-white/30",               border: "border-white/40",      glow: "shadow-[0_0_20px_rgba(255,255,255,0.2)]" },
};

function rarityStyles(rarity: string) {
  return RARITY_COLOURS[rarity] ?? {
    pill:   "bg-stone-500/20 text-stone-300 border-stone-500/50",
    border: "border-stone-500/40",
    glow:   "",
  };
}

// ─── Battle gate helpers ─────────────────────────────────────────────────────────────

// Fix 1: per-battle title/subtitle derived from battleEnemyKey
const BATTLE_META: Record<string, { title: string; subtitle: string }> = {
  field_1:          { title: "Battle of Okehazama",    subtitle: "Imagawa Vanguard stands before you." },
  kenshin_vanguard: { title: "Battle of Kawanakajima", subtitle: "Uesugi Kenshin's vanguard blocks the plain." },
};

function parseBattleEnemyKey(key: string | null | undefined): {
  endpoint: string;
  locationId: number;
} {
  if (!key) return { endpoint: "/api/battle/field", locationId: 1 };
  const parts = key.split("_");
  const last = parts[parts.length - 1];
  const locationId = isNaN(Number(last)) ? 1 : Number(last);
  const prefix = isNaN(Number(last)) ? key : parts.slice(0, -1).join("_");
  if (prefix.startsWith("boss"))    return { endpoint: "/api/battle/boss",         locationId };
  if (prefix.startsWith("special")) return { endpoint: "/api/battle/special-boss", locationId };
  return { endpoint: "/api/battle/field", locationId };
}

async function runStoryBattle(scene: Scene): Promise<{ victory: boolean; logs: string[] }> {
  const { endpoint, locationId } = parseBattleEnemyKey(scene.battleEnemyKey);
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId }),
    });
    if (!resp.ok) return { victory: false, logs: ["Battle system error — you retreat."] };
    const data = await resp.json();
    return { victory: !!data.victory, logs: Array.isArray(data.logs) ? data.logs : [] };
  } catch {
    return { victory: false, logs: ["Connection lost — you retreat."] };
  }
}

// ─── Visual maps ───────────────────────────────────────────────────────────────────────────

const BG_MAP: Record<string, string> = {
  // Chapter 1
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
  // Chapter 2 — Fix 2: all 11 missing background keys
  owari_castle_gate_morning:     "from-amber-950 via-stone-900 to-zinc-900",
  owari_castle_audience_hall:    "from-stone-950 via-zinc-900 to-black",
  owari_war_room_night:          "from-zinc-950 via-slate-900 to-black",
  kawanakajima_ford_dawn:        "from-sky-950 via-slate-900 to-stone-950",
  kawanakajima_mist_predawn:     "from-slate-900 via-zinc-950 to-black",
  kawanakajima_shrine_dusk:      "from-purple-950 via-stone-900 to-zinc-950",
  kawanakajima_shrine_night:     "from-violet-950 via-zinc-950 to-black",
  kawanakajima_plain_night:      "from-slate-950 via-zinc-900 to-black",
  kawanakajima_battlefield_dawn: "from-red-950 via-stone-900 to-zinc-950",
  kawanakajima_aftermath_smoke:  "from-orange-950 via-stone-800 to-zinc-900",
  kawanakajima_retreat_dusk:     "from-purple-950 via-red-950 to-black",
  default:                       "from-stone-950 via-zinc-900 to-black",
};

// Fix 3: Chapter 2 portrait colours + initials
const PORTRAIT_COLOURS: Record<string, string> = {
  // Chapter 1 — Nobunaga
  nobunaga_cold:        "bg-red-900 border-red-700",
  nobunaga_smirk:       "bg-red-800 border-red-600",
  nobunaga_fierce:      "bg-red-950 border-red-500",
  nobunaga_intrigued:   "bg-red-900 border-amber-600",
  // Chapter 1 — Hayashi
  hayashi_stern:        "bg-stone-700 border-stone-500",
  hayashi_shocked:      "bg-stone-600 border-stone-400",
  // Chapter 1 — Mitsuhide
  mitsuhide_calm:       "bg-blue-900 border-blue-600",
  mitsuhide_resolve:    "bg-blue-800 border-blue-500",
  mitsuhide_approving:  "bg-blue-700 border-blue-400",
  mitsuhide_disbelief:  "bg-blue-950 border-blue-400",
  mitsuhide_grave:      "bg-blue-950 border-blue-600",
  mitsuhide_grim:       "bg-slate-800 border-blue-600",
  // Chapter 1 — Others
  monk_fearful:         "bg-amber-900 border-amber-600",
  scout_panicked:       "bg-green-950 border-green-700",
  kenshin_portrait:     "bg-indigo-900 border-indigo-500",
  messenger_formal:     "bg-stone-800 border-stone-500",
  // Chapter 2 — Mitsuhide new moods
  mitsuhide_concerned:  "bg-blue-900 border-blue-500",
  mitsuhide_tense:      "bg-blue-950 border-blue-400",
  // Chapter 2 — Hideyoshi
  hideyoshi_grinning:   "bg-yellow-800 border-yellow-600",
  hideyoshi_pouting:    "bg-yellow-900 border-yellow-700",
  hideyoshi_excited:    "bg-amber-700 border-amber-500",
  hideyoshi_nervous:    "bg-yellow-950 border-yellow-700",
  hideyoshi_elated:     "bg-amber-800 border-amber-600",
  hideyoshi_serious:    "bg-yellow-900 border-yellow-600",
  // Chapter 2 — Uesugi Envoy
  uesugi_envoy_formal:    "bg-indigo-900 border-indigo-600",
  uesugi_envoy_surprised: "bg-indigo-800 border-indigo-500",
  uesugi_envoy_offended:  "bg-indigo-950 border-red-600",
  // Chapter 2 — Kenshin (armoured)
  kenshin_war_helm:     "bg-indigo-950 border-indigo-300",
};

const PORTRAIT_INITIALS: Record<string, string> = {
  // Chapter 1
  nobunaga_cold: "N", nobunaga_smirk: "N", nobunaga_fierce: "N", nobunaga_intrigued: "N",
  hayashi_stern: "H", hayashi_shocked: "H",
  mitsuhide_calm: "M", mitsuhide_resolve: "M", mitsuhide_approving: "M",
  mitsuhide_disbelief: "M", mitsuhide_grave: "M", mitsuhide_grim: "M",
  monk_fearful: "Mo", scout_panicked: "Sc",
  kenshin_portrait: "K", messenger_formal: "Me",
  // Chapter 2
  mitsuhide_concerned: "M", mitsuhide_tense: "M",
  hideyoshi_grinning: "Hi", hideyoshi_pouting: "Hi", hideyoshi_excited: "Hi",
  hideyoshi_nervous: "Hi",  hideyoshi_elated: "Hi",  hideyoshi_serious: "Hi",
  uesugi_envoy_formal: "E", uesugi_envoy_surprised: "E", uesugi_envoy_offended: "E",
  kenshin_war_helm: "K",
};

const FLAG_LABELS: Record<string, string> = {
  ruthlessness:          "⚔ Ruthless",
  political_power:       "⚖ Political",
  mitsuhide_loyalty:     "⚔ Mitsuhide",
  supernatural_affinity: "✦ Supernatural",
};

// ─── Sub-components ───────────────────────────────────────────────────────────────────

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

function FlagBar({ flags }: { flags: StoryFlags }) {
  const entries = Object.entries(flags).filter(([, v]) => v !== 0);
  if (!entries.length) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {entries.map(([k, v]) => (
        <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/20">
          {FLAG_LABELS[k] ?? k} {v > 0 ? `+${v}` : v}
        </span>
      ))}
    </div>
  );
}

// ─── Companion unlock card ─────────────────────────────────────────────────────────────

function CompanionUnlockCard({
  companion,
  index,
}: {
  companion: UnlockedCompanion;
  index: number;
}) {
  const styles = rarityStyles(companion.rarity);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", bounce: 0.35, delay: index * 0.12 }}
      className={`rounded-lg border-2 bg-black/50 backdrop-blur p-4 text-left ${
        styles.border
      } ${styles.glow}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
            styles.pill
          }`}
        >
          {companion.rarity}
        </span>
        <span className="text-white font-bold text-sm">{companion.name}</span>
      </div>
      <p className="text-stone-400 text-xs italic leading-relaxed">
        &ldquo;{companion.unlockMessage}&rdquo;
      </p>
    </motion.div>
  );
}

// ─── Battle overlay ─────────────────────────────────────────────────────────────────────

type BattlePhase = "idle" | "fighting" | "result";

function BattleGate({
  scene, bgGradient, onResult,
}: {
  scene: Scene; bgGradient: string; onResult: (won: boolean) => void;
}) {
  const [phase, setPhase]     = useState<BattlePhase>("idle");
  const [logs, setLogs]       = useState<string[]>([]);
  const [victory, setVictory] = useState<boolean | null>(null);

  // Fix 1: title/subtitle derived from battleEnemyKey, not hardcoded
  const meta = BATTLE_META[scene.battleEnemyKey ?? ""] ?? {
    title:    "Battle",
    subtitle: "An enemy force blocks your path.",
  };

  const fight = useCallback(async () => {
    setPhase("fighting");
    setLogs(["Crossing blades…"]);
    const result = await runStoryBattle(scene);
    setLogs(result.logs);
    setVictory(result.victory);
    setPhase("result");
  }, [scene]);

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col items-center justify-center p-8 text-center`}>
      <div className="max-w-md w-full">
        <p className="text-red-400 text-xs tracking-widest uppercase mb-4 animate-pulse">⚔ Battle</p>
        <h2 className="text-2xl font-bold text-white mb-2">{meta.title}</h2>
        <p className="text-stone-400 text-sm mb-6">{meta.subtitle}</p>
        {logs.length > 0 && (
          <div className="mb-6 max-h-48 overflow-y-auto rounded bg-black/60 border border-white/10 p-3 text-left">
            {logs.map((l, i) => <p key={i} className="text-xs text-stone-300 leading-relaxed">{l}</p>)}
          </div>
        )}
        {phase === "idle" && (
          <button onClick={fight} className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded font-semibold transition">
            ⚡ Enter Battle
          </button>
        )}
        {phase === "fighting" && <p className="text-stone-400 text-sm animate-pulse">Combat in progress…</p>}
        {phase === "result" && victory !== null && (
          <div className="flex flex-col items-center gap-4">
            <p className={`text-lg font-bold ${victory ? "text-amber-400" : "text-red-400"}`}>
              {victory ? "Victory!" : "Defeat…"}
            </p>
            <button onClick={() => onResult(victory)} className="px-6 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded text-sm transition">
              Continue ▸
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chapter-select screen ────────────────────────────────────────────────────────────────

function ChapterSelect({ onSelect }: { onSelect: (id: number) => void }) {
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    listChapters().then((data) => { setChapters(data); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading chronicles…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/map">
          <span className="text-stone-400 hover:text-white text-xs transition cursor-pointer">← Map</span>
        </Link>
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-amber-500" />
          <span className="text-white text-sm font-semibold tracking-widest uppercase">Chronicles</span>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-4">
        <p className="text-stone-500 text-xs tracking-widest uppercase mb-6">Select a chapter to begin</p>
        {chapters.map((ch) => {
          const locked     = ch.isLocked;
          const completed  = ch.isCompleted;
          const inProgress = !completed && ch.currentSceneId !== null;
          return (
            <button
              key={ch.id}
              disabled={locked}
              onClick={() => !locked && onSelect(ch.id)}
              className={`w-full text-left rounded-lg border p-5 transition-all duration-200 ${
                locked
                  ? "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
                  : completed
                  ? "border-amber-700/40 bg-amber-950/10 hover:bg-amber-950/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-600/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-stone-500 text-xs">Chapter {ch.chapterOrder}</span>
                    {completed && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <CheckCircle2 size={11} /> Complete
                      </span>
                    )}
                    {inProgress && (
                      <span className="flex items-center gap-1 text-blue-400 text-xs">
                        <PlayCircle size={11} /> In Progress
                      </span>
                    )}
                  </div>
                  <h2 className={`text-base font-bold mb-0.5 ${
                    locked ? "text-stone-600" : "text-white"
                  }`}>{ch.title}</h2>
                  {ch.subtitle && (
                    <p className="text-stone-500 text-xs italic">{ch.subtitle}</p>
                  )}
                </div>
                <div className="flex-shrink-0 mt-1">
                  {locked
                    ? <Lock size={16} className="text-stone-700" />
                    : completed
                    ? <CheckCircle2 size={16} className="text-amber-500" />
                    : <PlayCircle size={16} className="text-stone-400" />
                  }
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────────────

export default function StoryPage() {
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);

  const [chapter, setChapter]             = useState<ChapterData | null>(null);
  const [sceneId, setSceneId]             = useState<number | null>(null);
  const [lineIndex, setLineIndex]         = useState(0);
  const [showChoices, setShowChoices]     = useState(false);
  const [isComplete, setIsComplete]       = useState(false);
  const [isBattleGate, setIsBattleGate]   = useState(false);
  const [flags, setFlags]                 = useState<StoryFlags>({});
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [nextChapterId, setNextChapterId] = useState<number | null>(null);

  const [companionsUnlocked, setCompanionsUnlocked] = useState<UnlockedCompanion[]>([]);

  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sceneMap    = chapter ? Object.fromEntries(chapter.scenes.map((s) => [s.id, s])) : {};
  const scene       = sceneId ? sceneMap[sceneId] ?? null : null;
  const currentLine = scene?.dialogueLines[lineIndex] ?? null;

  // ── Load chapter ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeChapterId === null) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [chapterData, savedFlags, progress] = await Promise.all([
          fetchChapter(activeChapterId),
          getFlags(),
          getProgress(),
        ]);
        setChapter(chapterData);
        setFlags(savedFlags);
        const firstId = chapterData.firstSceneId ?? chapterData.scenes[0]?.id;
        if (progress && progress.chapterId === activeChapterId && !progress.isCompleted && progress.currentSceneId) {
          setSceneId(progress.currentSceneId);
        } else {
          await startChapter(activeChapterId, firstId);
          setSceneId(firstId);
        }
        setLineIndex(0);
        setShowChoices(false);
        setIsComplete(false);
        setIsBattleGate(false);
        setNextChapterId(null);
        setCompanionsUnlocked([]);
      } catch (e) {
        setError("Failed to load chapter. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeChapterId]);

  // ── Typewriter ───────────────────────────────────────────────────────────────────────
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

  useEffect(() => { if (scene) markSceneSeen(scene.sceneOrder); }, [sceneId]);

  const skipTypewriter = useCallback(() => {
    if (isTyping && currentLine) {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
      setDisplayedText(currentLine.text);
      setIsTyping(false);
    }
  }, [isTyping, currentLine]);

  // ── Advance ───────────────────────────────────────────────────────────────────────────────
  const advance = useCallback(async () => {
    if (!scene || !chapter) return;
    if (isTyping) { skipTypewriter(); return; }
    const nextLineIdx = lineIndex + 1;
    if (nextLineIdx < scene.dialogueLines.length) { setLineIndex(nextLineIdx); return; }
    if (scene.choices.length > 0) { setShowChoices(true); return; }
    if (scene.isBattleGate) { setIsBattleGate(true); return; }
    if (scene.isChapterEnd) {
      const result = await completeChapter({
        chapterId:         chapter.id,
        endingKey:         `ch${chapter.id}_complete`,
        endingTitle:       chapter.title,
        endingDescription: `${chapter.subtitle ?? ""} — Chapter complete.`,
      });
      if (result.nextChapterId) setNextChapterId(result.nextChapterId);
      setCompanionsUnlocked(result.companionsUnlocked);
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
    if (choice.flagKey  && choice.flagValue  !== null) mutations[choice.flagKey]  = choice.flagValue  ?? 0;
    if (choice.flagKey2 && choice.flagValue2 !== null) mutations[choice.flagKey2] = choice.flagValue2 ?? 0;
    if (Object.keys(mutations).length) {
      const updated = await applyFlags(mutations);
      setFlags(updated);
    }
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
    if (!chapter || activeChapterId === null) return;
    await resetStory();
    const firstId = chapter.firstSceneId ?? chapter.scenes[0]?.id;
    await startChapter(activeChapterId, firstId, true);
    setSceneId(firstId);
    setLineIndex(0);
    setShowChoices(false);
    setIsComplete(false);
    setIsBattleGate(false);
    setNextChapterId(null);
    setCompanionsUnlocked([]);
    setFlags({});
  }, [chapter, activeChapterId]);

  // ── Chapter-select ─────────────────────────────────────────────────────────────────────
  if (activeChapterId === null) {
    return <ChapterSelect onSelect={(id) => setActiveChapterId(id)} />;
  }

  // ── Loading / error ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading chapter…</p>
      </div>
    );
  }
  if (error || !chapter || !scene) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error ?? "Scene not found."}</p>
        <button onClick={() => setActiveChapterId(null)} className="text-stone-400 hover:text-white text-xs underline">
          ← Back to Chronicles
        </button>
      </div>
    );
  }

  const bgGradient    = BG_MAP[scene.backgroundKey] ?? BG_MAP.default;
  const leftPortrait  = currentLine?.speakerSide === "left"  ? currentLine.portraitKey : null;
  const rightPortrait = currentLine?.speakerSide === "right" ? currentLine.portraitKey : null;

  // ── Battle gate ──────────────────────────────────────────────────────────────────────
  if (isBattleGate) {
    return <BattleGate scene={scene} bgGradient={bgGradient} onResult={handleBattleResult} />;
  }

  // ── Chapter complete ───────────────────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black flex flex-col items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-amber-400 text-sm tracking-widest uppercase mb-4">Chapter Complete</p>
            <h1 className="text-3xl font-bold text-white mb-2">{chapter.title}</h1>
            <p className="text-stone-400 italic mb-8">{chapter.subtitle}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-4 bg-white/5 rounded border border-white/10"
          >
            <p className="text-stone-300 text-sm mb-3">Your story so far:</p>
            <FlagBar flags={flags} />
          </motion.div>

          <AnimatePresence>
            {companionsUnlocked.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8 text-left"
              >
                <p className="text-amber-300 text-xs font-bold tracking-widest uppercase mb-3">
                  ✦ Joined your clan!
                </p>
                <div className="flex flex-col gap-3">
                  {companionsUnlocked.map((c, i) => (
                    <CompanionUnlockCard key={c.name} companion={c} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {nextChapterId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + companionsUnlocked.length * 0.12 }}
              className="mb-6 p-3 rounded border border-amber-700/50 bg-amber-900/20"
            >
              <p className="text-amber-300 text-sm font-semibold">✦ New chapter unlocked!</p>
              <p className="text-stone-400 text-xs mt-1">Continue the story when you're ready.</p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 + companionsUnlocked.length * 0.12 }}
            className="flex gap-3 justify-center flex-wrap"
          >
            <button
              onClick={handleReset}
              className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition"
            >
              ↺ Replay Chapter
            </button>
            <button
              onClick={() => setActiveChapterId(null)}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm transition"
            >
              → Chronicles
            </button>
          </motion.div>

        </div>
      </div>
    );
  }

  // ── Main VN layout ───────────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col select-none`}
      onClick={!showChoices ? advance : undefined}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveChapterId(null); }}
          className="text-stone-400 hover:text-white text-xs transition"
        >
          ← Chronicles
        </button>
        <span className="text-stone-500 text-xs tracking-widest uppercase">
          Chapter {activeChapterId} · {chapter.title}
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
                <p className="text-amber-400 text-xs font-semibold tracking-wide mb-1">{currentLine.speakerName}</p>
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
        {!showChoices && !isTyping && (
          <p className="text-right text-stone-600 text-xs mt-2 animate-pulse">tap to continue ▸</p>
        )}
      </div>
    </div>
  );
}
