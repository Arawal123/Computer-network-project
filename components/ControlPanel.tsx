"use client";

import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
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
  globalRouting: boolean;
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
  onToggleGlobalRouting: () => void;
  onUpdateLink: (changes: Partial<LinkControls>) => void;
  onCutLink: () => void;
  onSeedChange: (seed: number) => void;
  onServerDown: () => void;
  onIncreaseServerLoad: () => void;
}

export default function ControlPanel({
  running,
  autoReroute,
  showPaths,
  globalRouting,
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
  onToggleGlobalRouting,
  onUpdateLink,
  onCutLink,
  onSeedChange,
  onServerDown,
  onIncreaseServerLoad
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
        <Button variant="primary" onClick={onToggleRun}>
          {running ? "Stop" : "Start"}
        </Button>
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
        <Button variant="ghost" onClick={onRandomize}>
          Random Topology
        </Button>
        <Button variant="secondary" onClick={onDemo}>
          Demo Scenario
        </Button>
        <Button className="col-span-2" variant="outline" onClick={onChaos}>
          Chaos Mode (10s)
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-xs text-white/70">Auto Reroute</span>
          <Switch checked={autoReroute} onCheckedChange={() => onToggleAutoReroute()} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-xs text-white/70">Show Paths</span>
          <Switch checked={showPaths} onCheckedChange={() => onToggleShowPaths()} />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-xs text-white/70">Global Server Routing</span>
          <Switch
            checked={globalRouting}
            onCheckedChange={() => onToggleGlobalRouting()}
          />
        </div>
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
              <Slider
                min={20}
                max={280}
                value={[linkControls.delayMs]}
                onValueChange={(value) => onUpdateLink({ delayMs: value[0] })}
              />
              <div className="text-xs text-white/50">
                {Math.round(linkControls.delayMs)} ms
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60">Loss (%)</label>
              <Slider
                min={0}
                max={30}
                value={[Math.round(linkControls.lossRate * 100)]}
                onValueChange={(value) =>
                  onUpdateLink({ lossRate: Number(value[0]) / 100 })
                }
              />
              <div className="text-xs text-white/50">
                {(linkControls.lossRate * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60">Bandwidth (pkts/s)</label>
              <Slider
                min={6}
                max={40}
                value={[Math.round(linkControls.bandwidth)]}
                onValueChange={(value) => onUpdateLink({ bandwidth: value[0] })}
              />
              <div className="text-xs text-white/50">
                {Math.round(linkControls.bandwidth)} packets/s
              </div>
            </div>
            <Button
              className="w-full"
              variant={linkControls.disabled ? "ghost" : "danger"}
              onClick={onCutLink}
            >
              {linkControls.disabled ? "Link Disabled" : "Cut Link"}
            </Button>
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
          <Button size="sm" variant="secondary" onClick={onReset}>
            Apply
          </Button>
        </div>
        <p className="text-xs text-white/40">
          Reproduce demos by using the same seed.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/80">Server Controls</h3>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="danger" onClick={onServerDown}>
            Bring Server Down
          </Button>
          <Button variant="outline" onClick={onIncreaseServerLoad}>
            Increase Server Load
          </Button>
        </div>
        <p className="text-xs text-white/40">
          Triggers CDN/anycast failover and latency shifts.
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
