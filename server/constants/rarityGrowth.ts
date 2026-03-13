/**
 * Single source of truth for rarity-based growth multipliers.
 * Used by equipment upgrades, companion upgrades, pet upgrades, and giveEquipmentExp.
 */
export const EQUIP_RARITY_GROWTH: Record<string, { atk: number; def: number; spd: number }> = {
  white:        { atk: 1.02, def: 1.03, spd: 1.05 },
  green:        { atk: 1.04, def: 1.06, spd: 1.08 },
  blue:         { atk: 1.06, def: 1.09, spd: 1.12 },
  purple:       { atk: 1.08, def: 1.12, spd: 1.15 },
  gold:         { atk: 1.12, def: 1.18, spd: 1.25 },
  mythic:       { atk: 1.16, def: 1.25, spd: 1.35 },
  exotic:       { atk: 1.22, def: 1.35, spd: 1.50 },
  transcendent: { atk: 1.30, def: 1.50, spd: 1.75 },
  celestial:    { atk: 1.45, def: 1.75, spd: 2.10 },
  primal:       { atk: 1.75, def: 2.25, spd: 3.00 },
};

export const COMPANION_RARITY_GROWTH: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
  "1": { hp: 1.05, atk: 1.02, def: 1.03, spd: 1.05 },
  "2": { hp: 1.08, atk: 1.04, def: 1.06, spd: 1.08 },
  "3": { hp: 1.12, atk: 1.06, def: 1.09, spd: 1.12 },
  "4": { hp: 1.15, atk: 1.08, def: 1.12, spd: 1.15 },
  "5": { hp: 1.25, atk: 1.12, def: 1.18, spd: 1.25 },
};

export const PET_RARITY_GROWTH: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
  white:        { hp: 1.05, atk: 1.02, def: 1.03, spd: 1.05 },
  green:        { hp: 1.08, atk: 1.04, def: 1.06, spd: 1.08 },
  blue:         { hp: 1.12, atk: 1.06, def: 1.09, spd: 1.12 },
  purple:       { hp: 1.15, atk: 1.08, def: 1.12, spd: 1.15 },
  gold:         { hp: 1.25, atk: 1.12, def: 1.18, spd: 1.25 },
  mythic:       { hp: 1.35, atk: 1.16, def: 1.25, spd: 1.35 },
  exotic:       { hp: 1.50, atk: 1.22, def: 1.35, spd: 1.50 },
  transcendent: { hp: 1.75, atk: 1.30, def: 1.50, spd: 1.75 },
  celestial:    { hp: 2.10, atk: 1.45, def: 1.75, spd: 2.10 },
  primal:       { hp: 3.00, atk: 1.75, def: 2.25, spd: 3.00 },
};
