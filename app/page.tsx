"use client";

import { useMemo, useRef, useState } from "react";
import ControlPanel from "../components/ControlPanel";
import MetricsPanel from "../components/MetricsPanel";
import NetworkCanvas, {
  LinkState,
  NetworkCanvasHandle
} from "../components/NetworkCanvas";
import TopBar from "../components/TopBar";
import { LinkSelection, MetricsSnapshot, SimulationSettings } from "../lib/types";

const defaultMetrics: MetricsSnapshot = {
  deliveryRate: 100,
  avgLatency: 0,
  sentPerSecond: 0,
  dropped: 0,
  delivered: 0,
  bestPathLength: 0,
  history: []
};

export default function HomePage() {
  const canvasRef = useRef<NetworkCanvasHandle | null>(null);
  const [running, setRunning] = useState(true);
  const [autoReroute, setAutoReroute] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [seed, setSeed] = useState(1337);
  const [selectedLink, setSelectedLink] = useState<LinkSelection | null>(null);
  const [linkControls, setLinkControls] = useState<LinkState | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot>(defaultMetrics);
  const [narration, setNarration] = useState(
    "Click a link to explore. Click two nodes to change the route."
  );

  const settings = useMemo<SimulationSettings>(
    () => ({
      autoReroute,
      showPaths,
      seed
    }),
    [autoReroute, showPaths, seed]
  );

  const handleSelectLink = (link: LinkSelection | null, state: LinkState | null) => {
    setSelectedLink(link);
    setLinkControls(state);
  };

  const handleUpdateLink = (changes: Partial<LinkState>) => {
    if (!selectedLink || !linkControls) return;
    const nextState = { ...linkControls, ...changes };
    setLinkControls(nextState);
    canvasRef.current?.updateLink(selectedLink.id, changes);
  };

  const handleToggleRun = () => {
    const next = !running;
    setRunning(next);
    canvasRef.current?.setRunning(next);
  };

  const handleReset = () => {
    canvasRef.current?.reset(seed);
    setSelectedLink(null);
    setLinkControls(null);
    setNarration("Simulation reset. Flow restored with fresh seed.");
  };

  const handleRandomize = () => {
    canvasRef.current?.randomize();
    setNarration("Topology randomized. Observe new best path decisions.");
  };

  const handleDemo = () => {
    canvasRef.current?.runDemo();
  };

  const handleChaos = () => {
    canvasRef.current?.runChaos();
  };

  const handleCutLink = () => {
    if (!selectedLink || !linkControls) return;
    const disabled = !linkControls.disabled;
    setLinkControls({ ...linkControls, disabled });
    canvasRef.current?.toggleLink(selectedLink.id, disabled);
  };

  return (
    <div className="min-h-screen flex flex-col bg-night">
      <TopBar />
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 px-6 py-6">
        <section className="flex flex-col gap-6">
          <div className="glass rounded-3xl p-6 bg-radial-soft">
            <h2 className="text-2xl font-semibold text-white mb-2">
              PulseRoute: Live Network Reroute Studio
            </h2>
            <p className="text-sm text-white/60 max-w-2xl">
              Watch packets fly across a glowing network map. Break links, crank up
              delay, and trigger chaos to see instant reroutes and resilience.
            </p>
          </div>
          <div className="flex-1 min-h-[420px]">
            <NetworkCanvas
              ref={canvasRef}
              running={running}
              settings={settings}
              onSelectLink={handleSelectLink}
              onMetrics={setMetrics}
              onNarration={setNarration}
            />
          </div>
          <MetricsPanel metrics={metrics} />
        </section>
        <ControlPanel
          running={running}
          autoReroute={autoReroute}
          showPaths={showPaths}
          selectedLink={selectedLink}
          linkControls={linkControls}
          seed={seed}
          narration={narration}
          onToggleRun={handleToggleRun}
          onReset={handleReset}
          onRandomize={handleRandomize}
          onDemo={handleDemo}
          onChaos={handleChaos}
          onToggleAutoReroute={() => setAutoReroute((prev) => !prev)}
          onToggleShowPaths={() => setShowPaths((prev) => !prev)}
          onUpdateLink={handleUpdateLink}
          onCutLink={handleCutLink}
          onSeedChange={setSeed}
        />
      </main>
    </div>
  );
}
