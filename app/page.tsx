"use client";

import { useMemo, useRef } from "react";
import ControlPanel from "../components/ControlPanel";
import IncidentFeed from "../components/IncidentFeed";
import MetricsPanel from "../components/MetricsPanel";
import NetworkCanvas, {
  LinkState,
  NetworkCanvasHandle
} from "../components/NetworkCanvas";
import TopBar from "../components/TopBar";
import { useSimulationStore } from "../lib/store";

export default function HomePage() {
  const canvasRef = useRef<NetworkCanvasHandle | null>(null);
  const running = useSimulationStore((state) => state.running);
  const settings = useSimulationStore((state) => state.settings);
  const seed = useSimulationStore((state) => state.seed);
  const selectedLink = useSimulationStore((state) => state.selectedLink);
  const linkControls = useSimulationStore((state) => state.linkControls);
  const metrics = useSimulationStore((state) => state.metrics);
  const narration = useSimulationStore((state) => state.narration);
  const incidents = useSimulationStore((state) => state.incidents);
  const setRunning = useSimulationStore((state) => state.setRunning);
  const setSeed = useSimulationStore((state) => state.setSeed);
  const setSettings = useSimulationStore((state) => state.setSettings);
  const setSelectedLink = useSimulationStore((state) => state.setSelectedLink);
  const setLinkControls = useSimulationStore((state) => state.setLinkControls);
  const setNarration = useSimulationStore((state) => state.setNarration);
  const setMetrics = useSimulationStore((state) => state.setMetrics);
  const addIncident = useSimulationStore((state) => state.addIncident);

  const busiestServerId = useMemo(() => {
    const entries = Object.entries(metrics.userCountsByServer ?? {});
    if (entries.length === 0) return "E";
    return entries.reduce((best, current) =>
      current[1] > best[1] ? current : best
    )[0];
  }, [metrics.userCountsByServer]);

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
    addIncident(
      `${disabled ? "Link disabled" : "Link restored"}: ${selectedLink.from} ↔ ${selectedLink.to}`,
      disabled ? "WARN" : "INFO"
    );
  };

  const handleServerDown = () => {
    const status = metrics.serverHealth?.[busiestServerId] ?? "UP";
    const isUp = status === "DOWN";
    canvasRef.current?.setServerStatus(busiestServerId, isUp);
  };

  const handleIncreaseServerLoad = () => {
    canvasRef.current?.addServerLoad(busiestServerId, 25);
  };

  return (
    <div className="min-h-screen flex flex-col bg-night">
      <TopBar />
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 px-6 py-6">
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
              onSelectLink={setSelectedLink}
              onMetrics={setMetrics}
              onNarration={setNarration}
              onIncident={addIncident}
            />
          </div>
          <MetricsPanel metrics={metrics} />
          <IncidentFeed incidents={incidents} />
        </section>
        <ControlPanel
          running={running}
          autoReroute={settings.autoReroute}
          showPaths={settings.showPaths}
          globalRouting={settings.globalRouting}
          selectedLink={selectedLink}
          linkControls={linkControls}
          seed={seed}
          narration={narration}
          onToggleRun={handleToggleRun}
          onReset={handleReset}
          onRandomize={handleRandomize}
          onDemo={handleDemo}
          onChaos={handleChaos}
          onToggleAutoReroute={() =>
            setSettings({ autoReroute: !settings.autoReroute })
          }
          onToggleShowPaths={() => setSettings({ showPaths: !settings.showPaths })}
          onToggleGlobalRouting={() =>
            setSettings({ globalRouting: !settings.globalRouting })
          }
          onUpdateLink={handleUpdateLink}
          onCutLink={handleCutLink}
          onSeedChange={setSeed}
          onServerDown={handleServerDown}
          onIncreaseServerLoad={handleIncreaseServerLoad}
        />
      </main>
    </div>
  );
}
