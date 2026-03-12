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
  type ProgressState,
  type StoryFlags,
} from "@/lib/story-engine";

// ─── Static chapter data (Phase 5 will fetch this from /api/story/chapters/1) ─

interface DialogueLine {
  speakerName: string;
  speakerSide: "left" | "right" | "none";
  portraitKey: string | null;
  text: string;
  lineOrder: number;
}

interface Choice {
  choiceText: string;
  nextSceneRef: string;
  flagKey: string | null;
  flagValue: number | null;
  flagKey2: string | null;
  flagValue2: number | null;
  choiceOrder: number;
}

interface Scene {
  sceneRef: string;
  backgroundKey: string;
  bgmKey: string;
  sceneOrder: number;
  nextSceneRef: string | null;
  isBattleGate: boolean;
  battleEnemyKey?: string;
  battleWinSceneRef?: string;
  battleLoseSceneRef?: string;
  isChapterEnd: boolean;
  dialogueLines: DialogueLine[];
  choices: Choice[];
}

// Background colour / gradient map — swap for real CSS bg images in Phase 5
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

// Portrait placeholder colours per character
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
  nobunaga_cold: "N", nobunaga_smirk: "N", nobunaga_fierce: "N", nobunaga_intrigued: "N",
  hayashi_stern: "H", hayashi_shocked: "H",
  mitsuhide_calm: "M", mitsuhide_resolve: "M", mitsuhide_approving: "M",
  mitsuhide_disbelief: "M", mitsuhide_grave: "M", mitsuhide_grim: "M",
  monk_fearful: "Mo", scout_panicked: "Sc",
  kenshin_portrait: "K", messenger_formal: "Me",
};

// Inline static chapter 1 data (replaced by API fetch in Phase 5)
const CHAPTER_1_SCENES: Scene[] = [
  {
    sceneRef: "S01", backgroundKey: "owari_province_dawn", bgmKey: "bgm_owari_morning",
    sceneOrder: 1, nextSceneRef: "S02", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "Your father died this morning. The clan elders already whisper — the fool inherits nothing worth keeping.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_cold",
        text: "Let them whisper.", lineOrder: 2 },
    ],
    choices: [],
  },
  {
    sceneRef: "S02", backgroundKey: "owari_castle_interior", bgmKey: "bgm_tense_court",
    sceneOrder: 2, nextSceneRef: null, isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Elder Hayashi", speakerSide: "left", portraitKey: "hayashi_stern",
        text: "You eat with commoners. You dress like a vagrant. You are an embarrassment to the Oda name.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_cold",
        text: "And yet here I am. And there you sit, asking my permission.", lineOrder: 2 },
      { speakerName: "Elder Hayashi", speakerSide: "left", portraitKey: "hayashi_stern",
        text: "The council demands you submit to our oversight. You are young, untested, and reckless.", lineOrder: 3 },
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "The elders watch you. Your first answer as lord of Owari will define what kind of warlord you become.", lineOrder: 4 },
    ],
    choices: [
      { choiceText: "\"I submit. For now. A wise lord listens before he acts.\"", nextSceneRef: "S03A", flagKey: "political_power", flagValue: 1, flagKey2: null, flagValue2: null, choiceOrder: 1 },
      { choiceText: "\"Kneel to no council. I am Oda Nobunaga.\"", nextSceneRef: "S03B", flagKey: "ruthlessness", flagValue: 1, flagKey2: null, flagValue2: null, choiceOrder: 2 },
    ],
  },
  {
    sceneRef: "S03A", backgroundKey: "owari_castle_interior", bgmKey: "bgm_tense_court",
    sceneOrder: 3, nextSceneRef: "S04", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "They smile. They think you are tamed. They are wrong.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_smirk",
        text: "A fox does not announce the hunt.", lineOrder: 2 },
    ],
    choices: [],
  },
  {
    sceneRef: "S03B", backgroundKey: "owari_castle_exterior", bgmKey: "bgm_defiance",
    sceneOrder: 4, nextSceneRef: "S04", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Elder Hayashi", speakerSide: "left", portraitKey: "hayashi_shocked",
        text: "You'll be dead within a year.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_fierce",
        text: "Then enjoy this year. It's the last you'll have power over anything.", lineOrder: 2 },
    ],
    choices: [],
  },
  {
    sceneRef: "S04", backgroundKey: "owari_road_afternoon", bgmKey: "bgm_journey",
    sceneOrder: 5, nextSceneRef: null, isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "A samurai from Mino arrives at your gate. Educated. Sharp-eyed. Looking for a lord worth serving.", lineOrder: 1 },
      { speakerName: "Mitsuhide", speakerSide: "left", portraitKey: "mitsuhide_calm",
        text: "I have heard of the Fool of Owari. I came to see if the rumors were true.", lineOrder: 2 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_cold",
        text: "And?", lineOrder: 3 },
      { speakerName: "Mitsuhide", speakerSide: "left", portraitKey: "mitsuhide_resolve",
        text: "They undersell you. I would serve you, if you'll have me.", lineOrder: 4 },
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "How you receive him sets the tone of your most important relationship.", lineOrder: 5 },
    ],
    choices: [
      { choiceText: "\"Welcome. A brilliant mind is rare — I'd be a fool to turn one away.\"", nextSceneRef: "S05", flagKey: "mitsuhide_loyalty", flagValue: 2, flagKey2: null, flagValue2: null, choiceOrder: 1 },
      { choiceText: "\"Prove yourself first. Fetch water from the well.\"", nextSceneRef: "S05", flagKey: "mitsuhide_loyalty", flagValue: 0, flagKey2: null, flagValue2: null, choiceOrder: 2 },
      { choiceText: "\"I trust no outsiders. Be gone.\"", nextSceneRef: "S05", flagKey: "mitsuhide_loyalty", flagValue: -1, flagKey2: "ruthlessness", flagValue2: 1, choiceOrder: 3 },
    ],
  },
  {
    sceneRef: "S05", backgroundKey: "nagashino_ruins_dusk", bgmKey: "bgm_ominous",
    sceneOrder: 6, nextSceneRef: null, isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Monk Messenger", speakerSide: "left", portraitKey: "monk_fearful",
        text: "My lord — near Nagashino. Workers unearthed a blade. Three men dead. No wounds. The blade sings at night.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_cold",
        text: "...", lineOrder: 2 },
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "A cursed blade. Power wrapped in danger. What you do next will shape your relationship with the spirit world.", lineOrder: 3 },
    ],
    choices: [
      { choiceText: "\"Send men to retrieve it. Power is power.\"", nextSceneRef: "S06A", flagKey: "supernatural_affinity", flagValue: 2, flagKey2: null, flagValue2: null, choiceOrder: 1 },
      { choiceText: "\"Destroy it. Superstition breeds weakness in my men.\"", nextSceneRef: "S06B", flagKey: "supernatural_affinity", flagValue: -1, flagKey2: "mitsuhide_loyalty", flagValue2: 1, choiceOrder: 2 },
    ],
  },
  {
    sceneRef: "S06A", backgroundKey: "owari_castle_armory_night", bgmKey: "bgm_ominous",
    sceneOrder: 7, nextSceneRef: "S07", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "The sword arrives wrapped in black silk. Your men refuse to touch it. You pick it up yourself.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_intrigued",
        text: "It hums. Like recognition.", lineOrder: 2 },
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "Something stirs at the edge of your mind. Ancient. Patient. Hungry.", lineOrder: 3 },
    ],
    choices: [],
  },
  {
    sceneRef: "S06B", backgroundKey: "nagashino_ruins_ash", bgmKey: "bgm_resolve",
    sceneOrder: 8, nextSceneRef: "S07", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "The blade is destroyed. The monk bows deeply. Mitsuhide stands at your shoulder, watching.", lineOrder: 1 },
      { speakerName: "Mitsuhide", speakerSide: "left", portraitKey: "mitsuhide_approving",
        text: "A wise decision, my lord. A blade that kills its bearers serves no one.", lineOrder: 2 },
    ],
    choices: [],
  },
  {
    sceneRef: "S07", backgroundKey: "owari_border_storm", bgmKey: "bgm_war_drums",
    sceneOrder: 9, nextSceneRef: null, isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Scout", speakerSide: "left", portraitKey: "scout_panicked",
        text: "25,000 men, my lord. Imagawa Yoshimoto marches for Kyoto. He passes through Owari like we don't exist.", lineOrder: 1 },
      { speakerName: "Mitsuhide", speakerSide: "left", portraitKey: "mitsuhide_grave",
        text: "We have 2,000. This is not a battle. This is an execution.", lineOrder: 2 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_fierce",
        text: "Or an opportunity. Storms are loud. Scouts go blind. 25,000 men cannot all watch at once.", lineOrder: 3 },
    ],
    choices: [
      { choiceText: "\"Strike now — full ambush in the storm. No hesitation.\"", nextSceneRef: "S08_BATTLE", flagKey: "ruthlessness", flagValue: 2, flagKey2: null, flagValue2: null, choiceOrder: 1 },
      { choiceText: "\"Send a decoy force to draw attention. We flank quietly.\"", nextSceneRef: "S08_BATTLE", flagKey: "political_power", flagValue: 1, flagKey2: null, flagValue2: null, choiceOrder: 2 },
    ],
  },
  {
    sceneRef: "S08_BATTLE", backgroundKey: "okehazama_gorge_storm", bgmKey: "bgm_war_drums",
    sceneOrder: 10, nextSceneRef: null,
    isBattleGate: true, battleEnemyKey: "imagawa_vanguard",
    battleWinSceneRef: "S09_WIN", battleLoseSceneRef: "S09_LOSE",
    isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "The storm breaks. Lightning splits the sky over Okehazama gorge. Yoshimoto rests in his palanquin, certain no fool would attack in this weather.", lineOrder: 1 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_fierce",
        text: "Move.", lineOrder: 2 },
    ],
    choices: [],
  },
  {
    sceneRef: "S09_WIN", backgroundKey: "okehazama_aftermath_dawn", bgmKey: "bgm_victory_somber",
    sceneOrder: 11, nextSceneRef: "S10", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "Yoshimoto is dead. His head is in your hands. 25,000 men scatter like smoke in the morning wind.", lineOrder: 1 },
      { speakerName: "Mitsuhide", speakerSide: "left", portraitKey: "mitsuhide_disbelief",
        text: "...How.", lineOrder: 2 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_smirk",
        text: "They were waiting for a battle. I gave them a storm.", lineOrder: 3 },
    ],
    choices: [],
  },
  {
    sceneRef: "S09_LOSE", backgroundKey: "owari_castle_night_rain", bgmKey: "bgm_defeat",
    sceneOrder: 12, nextSceneRef: "S10", isBattleGate: false, isChapterEnd: false,
    dialogueLines: [
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "The ambush fails. You retreat through the storm, wounded. Yoshimoto marches on, laughing at the Fool of Owari.", lineOrder: 1 },
      { speakerName: "Mitsuhide", speakerSide: "left", portraitKey: "mitsuhide_grim",
        text: "We live. That is enough for today, my lord.", lineOrder: 2 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_cold",
        text: "No. It is not enough. It will never be enough.", lineOrder: 3 },
    ],
    choices: [],
  },
  {
    sceneRef: "S10", backgroundKey: "owari_castle_night", bgmKey: "bgm_tension_resolve",
    sceneOrder: 13, nextSceneRef: null, isBattleGate: false, isChapterEnd: true,
    dialogueLines: [
      { speakerName: "Messenger", speakerSide: "left", portraitKey: "messenger_formal",
        text: "My lord. A letter. Seal of the Uesugi clan.", lineOrder: 1 },
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "You break the seal. The handwriting is precise. Controlled. The hand of a man who has never doubted himself.", lineOrder: 2 },
      { speakerName: "Kenshin (letter)", speakerSide: "left", portraitKey: "kenshin_portrait",
        text: "The Fool of Owari has teeth. Interesting. We will meet, and I will judge whether you are a sword worth fearing — or a plague to be ended.", lineOrder: 3 },
      { speakerName: "Nobunaga", speakerSide: "right", portraitKey: "nobunaga_smirk",
        text: "Tell him I look forward to his judgment.", lineOrder: 4 },
      { speakerName: "Narrator", speakerSide: "none", portraitKey: null,
        text: "The first step is taken. Japan watches. The age of the Fool of Owari has begun.", lineOrder: 5 },
    ],
    choices: [],
  },
];

const SCENE_MAP = Object.fromEntries(CHAPTER_1_SCENES.map((s) => [s.sceneRef, s]));
const FIRST_SCENE_REF = "S01";
const CHAPTER_ID = 1;
const FIRST_SCENE_ID = 1; // matches DB chapterId=1 firstSceneId=1

// ─── Portrait component ───────────────────────────────────────────────────────

function Portrait({ portraitKey, side }: { portraitKey: string | null; side: "left" | "right" }) {
  if (!portraitKey) return <div className="w-28 h-36 md:w-32 md:h-44" />;
  const colours = PORTRAIT_COLOURS[portraitKey] ?? "bg-stone-700 border-stone-500";
  const initials = PORTRAIT_INITIALS[portraitKey] ?? "?";
  const flip = side === "right" ? "scale-x-[-1]" : "";
  return (
    <div
      className={`w-28 h-36 md:w-32 md:h-44 rounded-sm border-2 ${colours} ${flip}
        flex items-end justify-center pb-1 shadow-lg flex-shrink-0
        transition-all duration-300`}
    >
      <span className={`text-2xl font-bold text-white/60 ${flip}`}>{initials}</span>
    </div>
  );
}

// ─── Flag bar ─────────────────────────────────────────────────────────────────

function FlagBar({ flags }: { flags: StoryFlags }) {
  const entries = Object.entries(flags).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  const LABEL: Record<string, string> = {
    ruthlessness: "☠ Ruthless",
    political_power: "⚖ Political",
    mitsuhide_loyalty: "⚔ Mitsuhide",
    supernatural_affinity: "✦ Supernatural",
  };
  return (
    <div className="flex gap-2 flex-wrap">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/20"
        >
          {LABEL[k] ?? k} {v > 0 ? `+${v}` : v}
        </span>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryPage() {
  const [sceneRef, setSceneRef] = useState<string>(FIRST_SCENE_REF);
  const [lineIndex, setLineIndex] = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isBattleGate, setIsBattleGate] = useState(false);
  const [battleScene, setBattleScene] = useState<Scene | null>(null);
  const [flags, setFlags] = useState<StoryFlags>({});
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = SCENE_MAP[sceneRef];
  const currentLine = scene?.dialogueLines[lineIndex];

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      const progress = await getProgress();
      const savedFlags = await getFlags();
      setFlags(savedFlags);
      if (progress && progress.chapterId === CHAPTER_ID && !progress.isCompleted) {
        // We store sceneRef as currentSceneId encoded: just use FIRST for now
        // Full ID↔ref mapping comes in Phase 5
      } else {
        await startChapter(CHAPTER_ID, FIRST_SCENE_ID);
      }
    })();
  }, []);

  // Typewriter effect
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
      if (i < full.length) {
        typeTimerRef.current = setTimeout(tick, 22);
      } else {
        setIsTyping(false);
      }
    };
    typeTimerRef.current = setTimeout(tick, 22);
    return () => { if (typeTimerRef.current) clearTimeout(typeTimerRef.current); };
  }, [sceneRef, lineIndex]);

  // Mark scene seen
  useEffect(() => {
    if (scene) markSceneSeen(scene.sceneOrder);
  }, [sceneRef]);

  const skipTypewriter = useCallback(() => {
    if (isTyping && currentLine) {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
      setDisplayedText(currentLine.text);
      setIsTyping(false);
    }
  }, [isTyping, currentLine]);

  const advance = useCallback(async () => {
    if (!scene) return;

    // If still typing, skip to end first
    if (isTyping) { skipTypewriter(); return; }

    const nextLineIdx = lineIndex + 1;

    if (nextLineIdx < scene.dialogueLines.length) {
      setLineIndex(nextLineIdx);
      return;
    }

    // All lines shown — check what comes next
    if (scene.choices.length > 0) {
      setShowChoices(true);
      return;
    }

    if (scene.isBattleGate) {
      setIsBattleGate(true);
      setBattleScene(scene);
      return;
    }

    if (scene.isChapterEnd) {
      await completeChapter();
      await unlockEnding({
        endingKey: "ch1_complete",
        endingTitle: "The Fool of Owari",
        endingDescription: "Chapter 1 complete. Japan watches.",
      });
      setIsComplete(true);
      return;
    }

    if (scene.nextSceneRef) {
      await advanceScene(scene.sceneOrder + 1);
      setSceneRef(scene.nextSceneRef);
      setLineIndex(0);
      setShowChoices(false);
    }
  }, [scene, lineIndex, isTyping, skipTypewriter]);

  const handleChoice = useCallback(async (choice: Choice) => {
    const mutations: StoryFlags = {};
    if (choice.flagKey && choice.flagValue !== null) mutations[choice.flagKey] = choice.flagValue;
    if (choice.flagKey2 && choice.flagValue2 !== null) mutations[choice.flagKey2] = choice.flagValue2;
    if (Object.keys(mutations).length > 0) {
      const updated = await applyFlags(mutations);
      setFlags(updated);
    }
    await advanceScene(scene.sceneOrder + 1);
    setSceneRef(choice.nextSceneRef);
    setLineIndex(0);
    setShowChoices(false);
  }, [scene]);

  const handleBattleResult = useCallback(async (won: boolean) => {
    if (!battleScene) return;
    const nextRef = won ? battleScene.battleWinSceneRef! : battleScene.battleLoseSceneRef!;
    setIsBattleGate(false);
    setBattleScene(null);
    await advanceScene(scene.sceneOrder + 1);
    setSceneRef(nextRef);
    setLineIndex(0);
    setShowChoices(false);
  }, [battleScene, scene]);

  const handleReset = useCallback(async () => {
    await resetStory();
    setSceneRef(FIRST_SCENE_REF);
    setLineIndex(0);
    setShowChoices(false);
    setIsComplete(false);
    setIsBattleGate(false);
    setBattleScene(null);
    setFlags({});
    await startChapter(CHAPTER_ID, FIRST_SCENE_ID, true);
  }, []);

  if (!scene) return <div className="text-white p-8">Scene not found.</div>;

  const bgGradient = BG_MAP[scene.backgroundKey] ?? BG_MAP.default;
  const leftPortrait = currentLine?.speakerSide === "left" ? currentLine.portraitKey : null;
  const rightPortrait = currentLine?.speakerSide === "right" ? currentLine.portraitKey : null;

  // ── Chapter complete screen ──────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-lg">
          <p className="text-amber-400 text-sm tracking-widest uppercase mb-4">Chapter Complete</p>
          <h1 className="text-3xl font-bold text-white mb-2">The Fool of Owari</h1>
          <p className="text-stone-400 italic mb-8">1551 — The land mocks you. Let it.</p>
          <div className="mb-8 p-4 bg-white/5 rounded border border-white/10">
            <p className="text-stone-300 text-sm mb-3">Your story so far:</p>
            <FlagBar flags={flags} />
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={handleReset}
              className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded text-sm transition"
            >
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

  // ── Battle gate screen ───────────────────────────────────────────────────
  if (isBattleGate && battleScene) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${bgGradient} flex flex-col items-center justify-center p-8 text-center`}>
        <div className="max-w-md">
          <p className="text-red-400 text-xs tracking-widest uppercase mb-4 animate-pulse">⚔ Battle</p>
          <h2 className="text-2xl font-bold text-white mb-2">Battle of Okehazama</h2>
          <p className="text-stone-400 text-sm mb-8">Imagawa Vanguard stands before you.</p>
          <p className="text-stone-500 text-xs mb-6 italic">
            (Full battle integration in Phase 5 — for now simulate the outcome)
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handleBattleResult(true)}
              className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded font-semibold transition"
            >
              ⚡ Victory
            </button>
            <button
              onClick={() => handleBattleResult(false)}
              className="px-6 py-3 bg-stone-700 hover:bg-stone-600 text-white rounded font-semibold transition"
            >
              ✕ Defeat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main VN layout ───────────────────────────────────────────────────────
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
          Chapter 1 · The Fool of Owari
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
        <div className={`transition-all duration-300 ${leftPortrait ? "opacity-100 translate-y-0" : "opacity-30 translate-y-2"}` }>
          <Portrait portraitKey={leftPortrait} side="left" />
        </div>
        <div className={`transition-all duration-300 ${rightPortrait ? "opacity-100 translate-y-0" : "opacity-30 translate-y-2"}` }>
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

        {/* Advance hint */}
        {!showChoices && !isTyping && (
          <p className="text-right text-stone-600 text-xs mt-2 animate-pulse">tap to continue ▸</p>
        )}
      </div>
    </div>
  );
}
