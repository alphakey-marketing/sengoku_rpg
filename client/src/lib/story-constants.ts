/**
 * story-constants.ts
 * Static lookup tables and catalogue data for the story system.
 * Extracted from story.tsx to keep that page file thin.
 */

/** Maps a backgroundKey to a Tailwind gradient string. */
export const BG_MAP: Record<string, string> = {
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

/** Maps a portraitKey to Tailwind background + border colours. */
export const PORTRAIT_COLOURS: Record<string, string> = {
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
  dosan_old:           "bg-stone-700 border-stone-500",
  dosan_approving:     "bg-stone-600 border-amber-600",
};

/** Maps a portraitKey to the 1-2 character initials shown inside the portrait. */
export const PORTRAIT_INITIALS: Record<string, string> = {
  nobunaga_cold:       "N",  nobunaga_smirk:      "N",  nobunaga_fierce:     "N",  nobunaga_intrigued:  "N",
  hayashi_stern:       "H",  hayashi_shocked:     "H",
  mitsuhide_calm:      "M",  mitsuhide_resolve:   "M",  mitsuhide_approving: "M",
  mitsuhide_disbelief: "M",  mitsuhide_grave:     "M",  mitsuhide_grim:      "M",  mitsuhide_quiet:     "M",
  monk_fearful:        "Mo", monk_envoy:          "Mo", scout_panicked:      "Sc",
  kenshin_portrait:    "K",  messenger_formal:    "Me",
  nohime_neutral:      "No", yoshiaki_desperate:  "Y",  lord_fujita:         "F",  merchant_kyoto:      "Me",
  dosan_old:           "D",  dosan_approving:     "D",
};

/** Maps a flagKey to a human-readable label shown in the FlagBar. */
export const FLAG_LABELS: Record<string, string> = {
  ruthlessness:           "⚔ Ruthless",
  political_power:        "⚖ Political",
  mitsuhide_loyalty:      "⚔ Mitsuhide",
  supernatural_affinity:  "❆ Supernatural",
  battle_won:             "⚡ Battle Won",
  battle_lost:            "☠ Battle Lost",
  nohime_trust:           "♥ Nohime",
  kennyo_hate:            "☯ Kennyo",
  // Ch3 witness flags — used by resolveConditionalScene, not shown in FlagBar
  nohime_witnessed_win:   "👁 Witnessed Victory",
  nohime_witnessed_loss:  "👁 Witnessed Defeat",
};

/** Where to navigate after each chapter completes. */
export const CHAPTER_COMPLETE_DESTINATION: Record<number, { path: string; label: string }> = {
  1: { path: "/",       label: "Enter the Dojo" },
  2: { path: "/stable", label: "Visit War Council" },
  3: { path: "/gear",   label: "Open the Armoury" },
  4: { path: "/gacha",  label: "Visit the Shrine" },
  5: { path: "/pets",   label: "Visit the Menagerie" },
  6: { path: "/party",  label: "Visit the Stables" },
  7: { path: "/map",    label: "Open Campaign Map" },
  8: { path: "/story",  label: "Return to Chronicles" },
};

/** Static chapter metadata shown in the chapter-select hub. */
export const CHAPTER_CATALOGUE = [
  { id: 1, title: "The Fool of Owari",          subtitle: "1551 — The land mocks you. Let it.",                                         available: true },
  { id: 2, title: "The Alliance of Wolves",      subtitle: "1552 — Every alliance is a leash. The question is who holds it.",            available: true },
  { id: 3, title: "The Mino Gambit",             subtitle: "1553 — Dosan built his empire on betrayal. Respect the lesson.",             available: true },
  { id: 4, title: "The Monk's Fire",             subtitle: "1554 — Religion is politics. Politics is war. War is religion.",             available: true },
  { id: 5, title: "The Mountain and the Mirror", subtitle: "1556 — Kenshin sees you. The question is whether you can see yourself.",    available: true },
  { id: 6, title: "Nohime's Gambit",             subtitle: "1558 — The sharpest blade in the castle was never at your hip.",             available: true },
  { id: 7, title: "The Price of Heaven",         subtitle: "1560 — Kyoto does not want you. It needs you. These are not the same thing.", available: true },
  { id: 8, title: "Honnoji",                     subtitle: "1582 — Every age ends the same way. The question is whether you chose it.",  available: true },
];
