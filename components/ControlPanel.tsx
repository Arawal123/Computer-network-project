"use client";

import { LinkSelection } from "../lib/types";

interface LinkControls {
  delayMs: number;
  lossRate: number;
  bandwidth: number;
  disabled: boolean;
}

interface ControlPanelProps {
  running: boolean;
  autoReroute: boolean;
  showPaths: boolean;
  selectedLink: LinkSelection | null;
  linkControls: LinkControls | null;
  seed: number;
  narration: string;
  onToggleRun: () => void;
  onReset: () => void;
  onRandomize: () => void;
  onDemo: () => void;
  onChaos: () => void;
  onToggleAutoReroute: () => void;
  onToggleShowPaths: () => void;
  onUpdateLink: (changes: Partial<LinkControls>) => void;
  onCutLink: () => void;
  onSeedChange: (seed: number) => void;
}

export default function ControlPanel({
  running,
  autoReroute,
  showPaths,
  selectedLink,
  linkControls,
  seed,
  narration,
  onToggleRun,
  onReset,
  onRandomize,
  onDemo,
  onChaos,
  onToggleAutoReroute,
  onToggleShowPaths,
  onUpdateLink,
  onCutLink,
  onSeedChange
}: ControlPanelProps) {
  return (
    <aside className="glass rounded-3xl p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Controls</h2>
        <p className="text-sm text-white/60">
          Interactively reroute traffic by tuning delay, loss, and bandwidth.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="rounded-2xl py-2 px-4 bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-medium hover:bg-neon-cyan/30 transition"
          onClick={onToggleRun}
        >
          {running ? "Stop" : "Start"}
        </button>
        <button
          className="rounded-2xl py-2 px-4 bg-white/10 border border-white/10 text-white hover:bg-white/20 transition"
          onClick={onReset}
        >
          Reset
        </button>
        <button
          className="rounded-2xl py-2 px-4 bg-white/5 border border-white/10 text-white hover:bg-white/20 transition"
          onClick={onRandomize}
        >
          Random Topology
        </button>
        <button
          className="rounded-2xl py-2 px-4 bg-neon-pink/20 border border-neon-pink/50 text-neon-pink font-medium hover:bg-neon-pink/30 transition"
          onClick={onDemo}
        >
          Demo Scenario
        </button>
        <button
          className="col-span-2 rounded-2xl py-2 px-4 bg-neon-purple/20 border border-neon-purple/50 text-neon-purple font-medium hover:bg-neon-purple/30 transition"
          onClick={onChaos}
        >
          Chaos Mode (10s)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onToggleAutoReroute}
          className={`rounded-2xl py-2 px-4 border transition ${
            autoReroute
              ? "bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan"
              : "bg-white/5 border-white/10 text-white"
          }`}
        >
          Auto Reroute {autoReroute ? "ON" : "OFF"}
        </button>
        <button
          onClick={onToggleShowPaths}
          className={`rounded-2xl py-2 px-4 border transition ${
            showPaths
              ? "bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan"
              : "bg-white/5 border-white/10 text-white"
          }`}
        >
          Show Paths {showPaths ? "ON" : "OFF"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/80">Selected Link</h3>
          <span className="text-xs text-white/50">
            {selectedLink ? `${selectedLink.from} → ${selectedLink.to}` : "None"}
          </span>
        </div>
        {linkControls ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60">Delay (ms)</label>
              <input
                type="range"
                min={20}
                max={280}
                value={linkControls.delayMs}
                onChange={(event) =>
                  onUpdateLink({ delayMs: Number(event.target.value) })
                }
                className="w-full"
              />
              <div className="text-xs text-white/50">
                {Math.round(linkControls.delayMs)} ms
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60">Loss (%)</label>
              <input
                type="range"
                min={0}
                max={30}
                value={Math.round(linkControls.lossRate * 100)}
                onChange={(event) =>
                  onUpdateLink({ lossRate: Number(event.target.value) / 100 })
                }
                className="w-full"
              />
              <div className="text-xs text-white/50">
                {(linkControls.lossRate * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60">Bandwidth (pkts/s)</label>
              <input
                type="range"
                min={6}
                max={40}
                value={Math.round(linkControls.bandwidth)}
                onChange={(event) =>
                  onUpdateLink({ bandwidth: Number(event.target.value) })
                }
                className="w-full"
              />
              <div className="text-xs text-white/50">
                {Math.round(linkControls.bandwidth)} packets/s
              </div>
            </div>
            <button
              className={`w-full rounded-xl py-2 text-sm font-semibold border transition ${
                linkControls.disabled
                  ? "bg-white/5 border-white/10 text-white/60"
                  : "bg-red-500/20 border-red-500/60 text-red-300"
              }`}
              onClick={onCutLink}
            >
              {linkControls.disabled ? "Link Disabled" : "Cut Link"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/40">
            Tap a link on the map to tune delay, loss, and bandwidth.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/80">Seed Control</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={seed}
            onChange={(event) => onSeedChange(Number(event.target.value))}
            className="flex-1 rounded-lg bg-night-2 border border-white/10 px-3 py-2 text-sm"
          />
          <button
            className="rounded-xl px-4 py-2 text-xs font-semibold bg-white/10 border border-white/10 hover:bg-white/20 transition"
            onClick={onReset}
          >
            Apply
          </button>
        </div>
        <p className="text-xs text-white/40">
          Reproduce demos by using the same seed.
        </p>
      </div>

      <div className="rounded-2xl border border-neon-purple/40 bg-neon-purple/10 p-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-neon-purple/80">
          Narration
        </p>
        <p className="text-sm text-white/80 min-h-[42px]">{narration}</p>
      </div>
    </aside>
  );
}
