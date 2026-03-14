/**
 * client/src/lib/nav-unlock.ts
 *
 * Progressive disclosure — chapter gates for every nav destination.
 *
 * Rules:
 *   - 0  = always visible (no chapter required)
 *   - N  = visible only when player.currentChapter >= N
 *
 * Story (/story) is always unlocked so new players land there first.
 * All other sections are introduced gradually as the narrative progresses,
 * so each unlock feels like a story reward rather than an arbitrary menu.
 *
 * To add a new route, append an entry here — no other file needs changing.
 */

export interface NavItem {
  title: string;
  url: string;
  icon: string;        // lucide icon name — resolved in app-sidebar.tsx
  unlockChapter: number;
  unlockHint: string;  // shown in the locked tooltip
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Chronicle (Story)",
    url: "/story",
    icon: "BookOpen",
    unlockChapter: 0,
    unlockHint: "",
  },
  {
    title: "Dojo (Home)",
    url: "/",
    icon: "Home",
    unlockChapter: 1,
    unlockHint: "Complete Chapter 1 to unlock your Dojo",
  },
  {
    title: "Daily Quests",
    url: "/quests",
    icon: "Sparkles",
    unlockChapter: 1,
    unlockHint: "Complete Chapter 1 to unlock Daily Quests",
  },
  {
    title: "War Council",
    url: "/stable",
    icon: "Users",
    unlockChapter: 2,
    unlockHint: "Complete Chapter 2 to recruit companions",
  },
  {
    title: "Battle Prep (Gear)",
    url: "/gear",
    icon: "ShieldAlert",
    unlockChapter: 3,
    unlockHint: "Complete Chapter 3 to access your Armoury",
  },
  {
    title: "Armory (Upgrade)",
    url: "/equipment",
    icon: "Sword",
    unlockChapter: 3,
    unlockHint: "Complete Chapter 3 to upgrade equipment",
  },
  {
    title: "Shrine (Gacha)",
    url: "/gacha",
    icon: "Zap",
    unlockChapter: 4,
    unlockHint: "Complete Chapter 4 to visit the Shrine",
  },
  {
    title: "Menagerie (Pets)",
    url: "/pets",
    icon: "Rabbit",
    unlockChapter: 5,
    unlockHint: "Complete Chapter 5 to tame spirit beasts",
  },
  {
    title: "Stables (Horses)",
    url: "/party",
    icon: "Tent",
    unlockChapter: 6,
    unlockHint: "Complete Chapter 6 to ride into battle",
  },
  {
    title: "Campaign (Map)",
    url: "/map",
    icon: "Map",
    unlockChapter: 7,
    unlockHint: "Complete Chapter 7 to expand your domain",
  },
];

/** Returns true if the player has reached the chapter required for this item. */
export function isNavUnlocked(item: NavItem, currentChapter: number): boolean {
  return currentChapter >= item.unlockChapter;
}
