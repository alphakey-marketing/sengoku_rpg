/** Generic random-pick helper used across the server */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.99) return "5";
  if (r > 0.90) return "4";
  if (r > 0.75) return "3";
  if (r > 0.50) return "2";
  return "1";
}
