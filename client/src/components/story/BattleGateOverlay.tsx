/**
 * BattleGateOverlay.tsx
 * Full-screen interstitial shown when a scene has isBattleGate=true.
 * Fires a field-battle API call and reports the win/lose result back
 * to StoryPlayer via the onResult callback.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Scene } from "@/lib/story-engine";

export interface BattleGateProps {
  scene: Scene;
  bgGradient: string;
  onResult: (won: boolean, logs: string[]) => void;
}

export function BattleGateOverlay({ scene, bgGradient, onResult }: BattleGateProps) {
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
    } catch (err: any) {
      setCombatLogs([`Error: ${err?.message ?? String(err)}`]);
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
                  won ? "bg-amber-700 hover:bg-amber-600" : "bg-zinc-700 hover:bg-zinc-600"
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
