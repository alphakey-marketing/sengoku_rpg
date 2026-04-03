/**
 * Canonical stat upgrade cost formula.
 * Used by BOTH the server (player routes) and the client (Dojo UI).
 * Never duplicate this — always import from here.
 *
 * Cost to upgrade a stat whose current value is `v`:
 *   2 pts at v 1-5, 3 pts at v 6-10, 4 pts at v 11-15, …
 */
export function statUpgradeCost(currentValue: number): number {
  return Math.floor((Math.max(1, currentValue) - 1) / 5) + 2;
}

/**
 * Total cost to apply `amount` upgrades starting from `currentValue`.
 */
export function totalUpgradeCost(currentValue: number, amount: number): number {
  let cost = 0;
  for (let i = 0; i < amount; i++) cost += statUpgradeCost(currentValue + i);
  return cost;
}
