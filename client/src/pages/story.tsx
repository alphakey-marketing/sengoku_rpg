import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
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
  type DialogueLine,
  type Choice,
  type Scene,
  type ChapterData,
} from "@/lib/story-engine";
import { usePlayer } from "@/hooks/use-game";

// ─── Visual maps ──────────────────────────────────────────────────────────────

const BG_MAP: Record<string, string> = {
  // ── Chapter 1 ──
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

  // ── Chapter 2 ──
  owari_road_morning:           "from-amber-900 via-yellow-900 to-stone-900",
  mikawa_border_meeting:        "from-stone-900 via-zinc-900 to-slate-900",
  kiyosu_conference_hall:       "from-stone-950 via-stone-900 to-zinc-900",
  mino_border_autumn_fog:       "from-slate-800 via-stone-800 to-zinc-900",
  mino_dosan_manor:             "from-stone-900 via-zinc-900 to-stone-950",
  mino_garden_autumn:           "from-amber-900 via-orange-950 to-stone-950",
  mino_garden_autumn_late:      "from-amber-950 via-orange-950 to-zinc-950",
  mino_garden_sunset:           "from-orange-900 via-amber-950 to-stone-950",
  mino_road_evening:            "from-amber-950 via-stone-900 to-zinc-950",
  mino_yoshitatsu_army_road:    "from-slate-900 via-stone-900 to-zinc-950",
  mino_border_pass_tense:       "from-slate-900 via-zinc-900 to-stone-950",
  mountain_pass_hidden:         "from-zinc-800 via-slate-900 to-stone-950",
  mino_border_negotiation:      "from-stone-800 via-zinc-900 to-slate-950",
  mino_border_pass_skirmish:    "from-red-950 via-slate-900 to-zinc-950",
  mino_border_pass_clear:       "from-blue-950 via-slate-900 to-stone-900",
  mino_border_retreat:          "from-slate-900 via-zinc-950 to-black",

  // ── Chapter 3 ──
  gifu_castle_tower_night:      "from-zinc-950 via-slate-950 to-black",
  gifu_castle_map_room_night:   "from-zinc-950 via-stone-950 to-black",

  // ── Chapter 4 ──
  nagashima_supply_road_smoke:  "from-stone-800 via-zinc-900 to-slate-950",
  gifu_castle_audience_chamber: "from-stone-900 via-zinc-900 to-stone-950",
  gifu_castle_stables:          "from-amber-950 via-stone-900 to-zinc-950",
  gifu_castle_gate:             "from-slate-900 via-stone-900 to-zinc-950",
  nagashima_village_burning:    "from-red-950 via-orange-950 to-stone-950",
  nagashima_village_ruins_dawn: "from-orange-950 via-stone-900 to-zinc-950",
  gifu_castle_outer_district:   "from-stone-900 via-zinc-900 to-slate-950",
  fortified_settlement_east:    "from-stone-900 via-zinc-800 to-slate-900",
  ikko_ikki_outpost_burning:    "from-red-950 via-stone-900 to-zinc-950",
  gifu_castle_corridor_night:   "from-zinc-950 via-slate-950 to-black",
  nagashima_delta_crossing_dawn:"from-blue-950 via-stone-900 to-amber-950",
  nagashima_crossing_aftermath: "from-stone-800 via-zinc-900 to-slate-950",
  nagashima_retreat_night:      "from-slate-950 via-zinc-950 to-black",

  // ── Chapter 5 ──
  mountain_road_north_mist:     "from-slate-800 via-zinc-900 to-stone-950",
  mountain_inn_exterior:        "from-stone-800 via-zinc-900 to-slate-900",
  mountain_inn_interior:        "from-stone-900 via-zinc-900 to-stone-950",
  mountain_inn_interior_dusk:   "from-amber-950 via-stone-900 to-zinc-950",
  mountain_inn_exterior_night:  "from-zinc-950 via-slate-950 to-black",
  gifu_castle_garden_evening:   "from-stone-900 via-zinc-900 to-black",

  // ── Chapter 6 ──
  gifu_castle_inner_garden:     "from-stone-900 via-zinc-900 to-slate-950",
  gifu_castle_map_room_day:     "from-stone-800 via-zinc-900 to-stone-950",
  gifu_castle_gate_day:         "from-slate-800 via-stone-900 to-zinc-950",
  fujita_manor_audience:        "from-stone-900 via-zinc-950 to-slate-950",

  // ── Chapter 7 ──
  kyoto_approach_road_autumn:   "from-amber-900 via-stone-900 to-zinc-950",
  kyoto_shogunal_palace:        "from-stone-800 via-zinc-900 to-slate-950",
  kyoto_shogunal_private_room:  "from-stone-900 via-zinc-950 to-slate-950",
  kyoto_approach_road_afternoon:"from-amber-950 via-stone-900 to-zinc-950",
  kyoto_street_market_afternoon:"from-amber-900 via-stone-900 to-zinc-900",
  kyoto_road_evening:           "from-amber-950 via-stone-950 to-zinc-950",
  kyoto_gate_outer_wall:        "from-slate-900 via-stone-900 to-zinc-950",
  kyoto_road_evening_clear:     "from-amber-900 via-stone-900 to-slate-950",
  kyoto_retreat_rainy:          "from-slate-900 via-blue-950 to-black",

  // ── Chapter 8 ──
  honnoji_temple_night_arrival:     "from-zinc-950 via-slate-950 to-black",
  honnoji_temple_courtyard_torches: "from-red-950 via-zinc-950 to-black",
  honnoji_inner_hall_smoke:         "from-stone-800 via-red-950 to-black",
  honnoji_inner_hall_desk:          "from-stone-900 via-zinc-950 to-black",
  honnoji_burning_inner_hall:       "from-red-950 via-orange-950 to-black",
  honnoji_dawn_aftermath:           "from-orange-950 via-stone-900 to-zinc-950",
  honnoji_burning_final:            "from-red-900 via-orange-950 to-black",
  japan_map_painted_scroll:         "from-amber-900 via-stone-900 to-zinc-950",

  default: "from-stone-950 via-zinc-900 to-black",
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
  mitsuhide_quiet:     "bg-blue-950 border-blue-500",
  monk_fearful:        "bg-amber-900 border-amber-600",
  monk_envoy:          "bg-amber-800 border-amber-600",
  scout_panicked:      "bg-green-950 border-green-700",
  kenshin_portrait:    "bg-indigo-900 border-indigo-500",
  messenger_formal:    "bg-stone-800 border-stone-500",
  nohime_neutral:      "bg-rose-900 border-rose-600",
  yoshiaki_desperate:  "bg-purple-950 border-purple-600",
  lord_fujita:         "bg-stone-800 border-stone-500",
  merchant_kyoto:      "bg-amber-900 border-amber-700",
};

const PORTRAIT_INITIALS: Record<string, string> = {
  nobunaga_cold:       "N", nobunaga_smirk:  "N", nobunaga_fierce: "N", nobunaga_intrigued: "N",
  hayashi_stern:       "H", hayashi_shocked: "H",
  mitsuhide_calm:      "M", mitsuhide_resolve: "M", mitsuhide_approving: "M",
  mitsuhide_disbelief: "M", mitsuhide_grave:   "M", mitsuhide_grim: "M", mitsuhide_quiet: "M",
  monk_fearful:   "Mo", monk_envoy: "Mo", scout_panicked: "Sc",
  kenshin_portrait: "K", messenger_formal: "Me",
  nohime_neutral: "No", yoshiaki_desperate: "Y", lord_fujita: "F", merchant_kyoto: "Me",
};

const FLAG_LABELS: Record<string, string> = {
  ruthlessness:          "⚔ Ruthless",
  political_power:       "⚖ Political",
  mitsuhide_loyalty:     "⚔ Mitsuhide",
  supernatural_affinity: "❆ Supernatural",
  battle_won:            "⚡ Battle Won",
  battle_lost:           "☠ Battle Lost",
  nohime_trust:          "♥ Nohime",
  kennyo_hate:           "☯ Kennyo",
};

// ─── Completion destinations ──────────────────────────────────────────────────
const CHAPTER_COMPLETE_DESTINATION: Record<number, { path: string; label: string }> = {
  1: { path: "/",       label: "Enter the Dojo" },
  2: { path: "/stable", label: "Visit War Council" },
  3: { path: "/gear",   label: "Open the Armoury" },
  4: { path: "/gacha",  label: "Visit the Shrine" },
  5: { path: "/pets",   label: "Visit the Menagerie" },
  6: { path: "/party",  label: "Visit the Stables" },
  7: { path: "/map",    label: "Open Campaign Map" },
  8: { path: "/story",  label: "Return to Chronicles" },
};

// ─── Chapter catalogue ────────────────────────────────────────────────────────
const CHAPTER_CATALOGUE = [
  { id: 1, title: "The Fool of Owari",          subtitle: "1551 — The land mocks you. Let it.",                                         available: true },
  { id: 2, title: "The Alliance of Wolves",      subtitle: "1552 — Every alliance is a leash. The question is who holds it.",            available: true },
  { id: 3, title: "The Mino Gambit",             subtitle: "1553 — Dosan built his empire on betrayal. Respect the lesson.",             available: true },
  { id: 4, title: "The Monk's Fire",             subtitle: "1554 — Religion is politics. Politics is war. War is religion.",             available: true },
  { id: 5, title: "The Mountain and the Mirror", subtitle: "1556 — Kenshin sees you. The question is whether you can see yourself.",    available: true },
  { id: 6, title: "Nohime's Gambit",             subtitle: "1558 — The sharpest blade in the castle was never at your hip.",             available: true },
  { id: 7, title: "The Price of Heaven",         subtitle: "1560 — Kyoto does not want you. It needs you. These are not the same thing.", available: true },
  { id: 8, title: "Honnoji",                     subtitle: "1582 — Every age ends the same way. The question is whether you chose it.",  available: true },
];

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

// ─── BattleGateOverlay ────────────────────────────────────────────────────────

interface BattleGateProps {
  scene: Scene;
  bgGradient: string;
  onResult: (won: boolean, logs: string[]) => void;
}

function BattleGateOverlay({ scene, bgGradient, onResult }: BattleGateProps) {
  const [phase, setPhase]           = useState<"idle" | "fighting" | "done">("idle");
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [won, setWon]               = useState<boolean | null>(null);
  const logRef                      = useRef<HTMLDivElement>(null);

  const locationId = (() => {
    if (!scene.battleEnemyKey) return 1;
    const m = scene.battleEnemyKey.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  })();

  const startBattle = useCallback(async () => {
    setPhase("fighting");
    setCombatLogs([]);
    try {
      const data = await apiRequest("POST", api.battle.field.path, { locationId, repeatCount: 1 });
      const logs: string[]   = data?.logs    ?? [];
      const victory: boolean = !!data?.victory;
      setCombatLogs(logs);
      setWon(victory);
      setPhase("done");
      apiRequest("POST", "/api/story/flags", {
        absolute: { battle_won: victory ? 1 : 0, battle_lost: victory ? 0 : 1 },
      }).catch(() => {});
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setCombatLogs([`Error: ${msg}`]);
      setPhase("done");
      setWon(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combatLogs]);

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col items-center justify-center p-6`}>
      <div className="w-full max-w-md">
        <p className="text-red-400 text-xs tracking-widest uppercase mb-3 text-center animate-pulse">⚔ Story Battle</p>
        <h2 className="text-xl font-bold text-white text-center mb-1">
          {scene.battleEnemyKey?.replace(/_/g, " ") ?? "Battle"}
        </h2>
        <p className="text-stone-400 text-sm text-center mb-5">
          Location {locationId} enemy forces block your path.
        </p>

        {phase === "idle" && (
          <button onClick={startBattle} className="w-full py-3 bg-red-800 hover:bg-red-700 text-white font-semibold rounded transition">
            ⚡ Enter Battle
          </button>
        )}

        {phase === "fighting" && (
          <div className="text-center">
            <p className="text-amber-400 text-sm animate-pulse mb-4">Combat in progress…</p>
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {phase === "done" && won !== null && (
          <div className="space-y-4">
            <div className={`text-center py-3 rounded border ${
              won ? "bg-amber-900/40 border-amber-600 text-amber-300" : "bg-red-900/40 border-red-700 text-red-300"
            }`}>
              <p className="text-lg font-bold">{won ? "⚡ Victory" : "☠ Defeat"}</p>
              <p className="text-xs mt-1 text-white/50">
                {won ? "Press below to continue your story." : "You may retry or accept defeat."}
              </p>
            </div>
            <div ref={logRef} className="bg-black/50 border border-white/10 rounded p-3 max-h-48 overflow-y-auto text-xs text-stone-300 space-y-0.5 font-mono">
              {combatLogs.map((l, i) => (
                <p key={i} className={l.startsWith("---") ? "text-white/40 text-center" : ""}>{l}</p>
              ))}
            </div>
            <div className="flex gap-3">
              {!won && (
                <button onClick={() => { setPhase("idle"); setWon(null); setCombatLogs([]); }}
                  className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 text-white text-sm rounded transition">
                  ↺ Retry
                </button>
              )}
              <button onClick={() => onResult(won, combatLogs)}
                className={`flex-1 py-2 text-white text-sm rounded transition ${
                  won ? "bg-amber-700 hover:bg-amber-600" : "bg-zinc-700 hover:bg-zinc-600"
                }`}>
                {won ? "→ Continue Story" : "→ Accept Defeat"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChapterSelectHub ─────────────────────────────────────────────────────────

interface ChapterSelectHubProps {
  currentChapter: number;
  onSelectChapter: (id: number) => void;
}

function ChapterSelectHub({ currentChapter, onSelectChapter }: ChapterSelectHubProps) {
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

// ─── StoryPlayer ──────────────────────────────────────────────────────────────

interface StoryPlayerProps {
  chapterId: number;
}

function StoryPlayer({ chapterId }: StoryPlayerProps) {
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

  // ── triggerCompletion ─────────────────────────────────────────────────────
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

  // ── Boot ──────────────────────────────────────────────────────────────────
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

  // ── Typewriter ────────────────────────────────────────────────────────────
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
    if (
      scene?.isChapterEnd &&
      isAtLastLine &&
      !isTyping &&
      !showChoices &&
      !isComplete &&
      !completionFiredRef.current
    ) {
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

  // ── handleChoice ──────────────────────────────────────────────────────────
  const handleChoice = useCallback(async (choice: Choice) => {
    if (!scene) return;
    const mutations: StoryFlags = {};
    if (choice.flagKey != null) mutations[choice.flagKey] = choice.flagValue ?? 0;
    if (choice.flagKey2 != null && choice.flagValue2 != null) mutations[choice.flagKey2] = choice.flagValue2;

    // Additive optimistic state — mirrors applyFlags() in story-engine.ts
    const optimistic = { ...flags };
    for (const [k, v] of Object.entries(mutations)) {
      optimistic[k] = (optimistic[k] ?? 0) + v;
    }
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
    const nextId = won
      ? (scene.battleWinSceneId ?? scene.nextSceneId)
      : (scene.battleLoseSceneId ?? scene.nextSceneId);
    if (!nextId) return;
    apiRequest("POST", "/api/story/flags", {
      absolute: { battle_won: won ? 1 : 0, battle_lost: won ? 0 : 1 },
    }).catch(() => {});

    let latestFlags = flags;
    try { latestFlags = await getFlags(); } catch {}
    setFlags(latestFlags);
    setSceneId(nextId);
    setLineIndex(0);
    setShowChoices(false);
    advanceScene(nextId).catch((err: any) => {
      console.warn("[story] advanceScene (battle) server error (non-blocking):", err?.message ?? err);
    });
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading chapter…</p>
      </div>
    );
  }

  // ── Coming Soon ───────────────────────────────────────────────────────────
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
          <button
            onClick={() => navigate("/story")}
            className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition"
          >
            ← Back to Chronicles
          </button>
        </div>
      </div>
    );
  }

  // ── Hard error ────────────────────────────────────────────────────────────
  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-400 text-sm">{error ?? "Chapter not found."}</p>
        <button
          onClick={() => navigate("/story")}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-sm rounded transition"
        >
          ← Back to Chronicles
        </button>
      </div>
    );
  }

  // ── Chapter complete screen ───────────────────────────────────────────────
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
            <button
              onClick={handleReset}
              className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition"
            >
              ↺ Replay Chapter
            </button>
            <button
              onClick={() => navigate(completionDest.path)}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm font-semibold transition"
            >
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
    return (
      <BattleGateOverlay
        scene={scene}
        bgGradient={bgGradient}
        onResult={handleBattleResult}
      />
    );
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryPage() {
  const params = useParams<{ chapterId?: string }>();
  const [, navigate] = useLocation();

  const { data: player, isLoading: playerLoading } = usePlayer();
  const currentChapter = player?.currentChapter ?? 0;

  const hasChapterParam    = !!params.chapterId;
  const chapterIdFromParam = params.chapterId ? parseInt(params.chapterId, 10) : null;

  if (playerLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (hasChapterParam && chapterIdFromParam) {
    return <StoryPlayer chapterId={chapterIdFromParam} />;
  }

  if (currentChapter >= 1) {
    return (
      <ChapterSelectHub
        currentChapter={currentChapter}
        onSelectChapter={(id) => navigate(`/story/${id}`)}
      />
    );
  }

  return <StoryPlayer chapterId={1} />;
}
