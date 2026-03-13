/** Classic item drop tables (Ragnarok-style) */
export const CLASSIC_DROPS = {
  weapon: [
    { name: "Knife",       atk: 17, reqLv: 1,  slots: 4 },
    { name: "Cutter",      atk: 28, reqLv: 1,  slots: 4 },
    { name: "Main Gauche", atk: 43, reqLv: 1,  slots: 4 },
    { name: "Sword",       atk: 25, reqLv: 2,  slots: 4 },
    { name: "Falchion",    atk: 39, reqLv: 2,  slots: 4 },
    { name: "Blade",       atk: 53, reqLv: 2,  slots: 4 },
    { name: "Bow",         atk: 15, reqLv: 1,  slots: 4 },
    { name: "Composite Bow", atk: 29, reqLv: 1, slots: 4 },
    { name: "Great Bow",   atk: 43, reqLv: 10, slots: 4 },
    { name: "Rod",         atk: 15, reqLv: 1,  matk: 15, slots: 4 },
    { name: "Wand",        atk: 34, reqLv: 1,  matk: 15, int: 1, slots: 4 },
  ],
  armor: [
    { name: "Cotton Shirt",      def: 1, reqLv: 1,  slots: 1 },
    { name: "Jacket",            def: 2, reqLv: 1,  slots: 1 },
    { name: "Adventurer's Suit", def: 3, reqLv: 1,  slots: 1 },
    { name: "Mantle",            def: 4, reqLv: 1,  slots: 1 },
    { name: "Coat",              def: 5, reqLv: 14, slots: 1 },
    { name: "Padded Armor",      def: 6, reqLv: 14, slots: 1 },
  ],
  shield: [
    { name: "Guard",   def: 3, reqLv: 1,  slots: 1 },
    { name: "Buckler", def: 4, reqLv: 14, slots: 1 },
  ],
  garment: [
    { name: "Hood",    def: 1, reqLv: 1,  slots: 1 },
    { name: "Muffler", def: 2, reqLv: 14, slots: 1 },
  ],
  footgear: [
    { name: "Sandals", def: 1, reqLv: 1,  slots: 1 },
    { name: "Shoes",   def: 2, reqLv: 14, slots: 1 },
  ],
  headgear: [
    { name: "Bandana",   def: 1, reqLv: 1,  slots: 0 },
    { name: "Cap",       def: 3, reqLv: 14, slots: 0 },
    { name: "Ribbon",    def: 1, reqLv: 1,  int: 1, mdef: 3, slots: 0 },
    { name: "Sunglasses", def: 0, reqLv: 1, slots: 0 },
    { name: "Flu Mask",  def: 0, reqLv: 1,  slots: 0 },
  ],
  accessory: [
    { name: "Novice Armlet", hp: 10,  reqLv: 1,  slots: 0 },
    { name: "Clip",                   reqLv: 1,  slots: 1 },
    { name: "Rosary",  luk: 2, mdef: 5, reqLv: 20, slots: 1 },
    { name: "Ring",    str: 2,         reqLv: 20, slots: 1 },
    { name: "Brooch",  agi: 2,         reqLv: 20, slots: 1 },
  ],
};

export const WEAPON_NAMES       = ["Katana", "Yari Spear", "Naginata", "Nodachi", "Tanto"];
export const ARMOR_NAMES        = ["Do (胴)", "Kabuto (兜)", "Kusazuri (草摺)", "Suneate (臑当)"];
export const ACCESSORY_NAMES    = ["Ninja Kunai", "Omamori Charm", "Smoke Bomb", "Shuriken Set"];
export const HORSE_GEAR_NAMES   = ["War Saddle", "Iron Stirrups", "Battle Reins", "Armored Barding"];
export const HORSE_NAMES        = ["Kiso Horse (木曽馬)", "Misaki Pony (御崎馬)", "Tokara Stallion (トカラ馬)"];

export const PET_NAMES = [
  { name: "Spirit Fox (妖狐)", skill: "Heal (回復)" },
  { name: "War Hawk (鷹)",    skill: "Scout (偵察)" },
  { name: "Shadow Cat (影猫)", skill: "Poison (毒)" },
];

/** Rarity stats for horses — used by generateHorse AND combine logic */
export const HORSE_RARITY_STATS: Record<string, { speed: number; atk: number; def: number }> = {
  white:        { speed: 10,  atk: 5,   def: 5   },
  green:        { speed: 20,  atk: 15,  def: 15  },
  blue:         { speed: 35,  atk: 30,  def: 30  },
  purple:       { speed: 60,  atk: 50,  def: 50  },
  gold:         { speed: 100, atk: 85,  def: 85  },
  mythic:       { speed: 160, atk: 140, def: 140 },
  exotic:       { speed: 240, atk: 210, def: 210 },
  transcendent: { speed: 340, atk: 300, def: 300 },
  celestial:    { speed: 460, atk: 410, def: 410 },
  primal:       { speed: 600, atk: 540, def: 540 },
};

export const RARITY_ORDER = [
  'white', 'green', 'blue', 'purple', 'gold',
  'mythic', 'exotic', 'transcendent', 'celestial', 'primal',
];
