"use client";

import type React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { NetworkSimulation } from "../lib/simulation";
import { LinkSelection, MetricsSnapshot, SimulationSettings } from "../lib/types";
import { distanceToSegment, lerp } from "../lib/utils";

export interface NetworkCanvasHandle {
  setRunning: (running: boolean) => void;
  reset: (seed: number) => void;
  randomize: () => void;
  updateLink: (linkId: string, changes: Partial<LinkState>) => void;
  toggleLink: (linkId: string, disabled: boolean) => void;
  setEndpoints: (source: string, destination: string) => void;
  runDemo: () => void;
  runChaos: () => void;
}

export interface LinkState {
  delayMs: number;
  lossRate: number;
  bandwidth: number;
  disabled: boolean;
}

interface NetworkCanvasProps {
  running: boolean;
  settings: SimulationSettings;
  onSelectLink: (link: LinkSelection | null, state: LinkState | null) => void;
  onMetrics: (metrics: MetricsSnapshot) => void;
  onNarration: (text: string) => void;
}

const NetworkCanvas = forwardRef<NetworkCanvasHandle, NetworkCanvasProps>(
  ({ running, settings, onSelectLink, onMetrics, onNarration }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const simRef = useRef<NetworkSimulation | null>(null);
    const frameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const timeoutsRef = useRef<number[]>([]);
    const pendingSourceRef = useRef<string | null>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    const settingsMemo = useMemo(() => settings, [settings]);

    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    const initSimulation = useCallback(() => {
      if (!canvasRef.current) return;
      simRef.current = new NetworkSimulation({
        width: dimensions.width,
        height: dimensions.height,
        seed: settingsMemo.seed
      });
      simRef.current.setSettings(settingsMemo);
    }, [dimensions.height, dimensions.width, settingsMemo]);

    useEffect(() => {
      initSimulation();
    }, [initSimulation]);

    useEffect(() => {
      if (simRef.current) {
        simRef.current.setSettings(settingsMemo);
      }
    }, [settingsMemo]);

    useEffect(() => {
      if (simRef.current) {
        simRef.current.running = running;
      }
    }, [running]);

    const animate = useCallback(
      (time: number) => {
        if (!canvasRef.current || !simRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        simRef.current.update(delta);
        renderScene(ctx, simRef.current, dimensions.width, dimensions.height);
        onMetrics(simRef.current.getMetrics());

        frameRef.current = requestAnimationFrame(animate);
      },
      [dimensions.height, dimensions.width, onMetrics]
    );

    useEffect(() => {
      frameRef.current = requestAnimationFrame(animate);
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    }, [animate]);

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !simRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const nodeHit = simRef.current.nodes.find(
          (node) => Math.hypot(x - node.x, y - node.y) < 0.04
        );
        if (nodeHit) {
          if (!pendingSourceRef.current) {
            pendingSourceRef.current = nodeHit.id;
            simRef.current.setSource(nodeHit.id);
            onNarration(`Source set to ${nodeHit.label}. Select destination.`);
          } else if (pendingSourceRef.current !== nodeHit.id) {
            simRef.current.setDestination(nodeHit.id);
            onNarration(
              `Destination set to ${nodeHit.label}. Packets rerouting now.`
            );
            pendingSourceRef.current = null;
          }
          return;
        }

        const linkHit = simRef.current.links.find((link) => {
          const from = simRef.current?.nodes.find((node) => node.id === link.from);
          const to = simRef.current?.nodes.find((node) => node.id === link.to);
          if (!from || !to) return false;
          return distanceToSegment(x, y, from.x, from.y, to.x, to.y) < 0.02;
        });

        if (linkHit) {
          onSelectLink(
            {
              id: linkHit.id,
              from: linkHit.from,
              to: linkHit.to
            },
            {
              delayMs: linkHit.delayMs,
              lossRate: linkHit.lossRate,
              bandwidth: linkHit.bandwidth,
              disabled: linkHit.disabled
            }
          );
        }
      },
      [onNarration, onSelectLink]
    );

    useImperativeHandle(ref, () => ({
      setRunning: (value: boolean) => {
        if (simRef.current) simRef.current.running = value;
      },
      reset: (seed: number) => {
        if (!simRef.current) return;
        simRef.current.reset(seed);
        onSelectLink(null, null);
      },
      randomize: () => {
        simRef.current?.randomizeTopology();
      },
      updateLink: (linkId: string, changes: Partial<LinkState>) => {
        if (!simRef.current) return;
        const updates: Partial<LinkState> = {};
        if (typeof changes.delayMs === "number") updates.delayMs = changes.delayMs;
        if (typeof changes.lossRate === "number")
          updates.lossRate = changes.lossRate;
        if (typeof changes.bandwidth === "number")
          updates.bandwidth = changes.bandwidth;
        if (typeof changes.disabled === "boolean")
          updates.disabled = changes.disabled;
        simRef.current.updateLink(linkId, updates);
      },
      toggleLink: (linkId: string, disabled: boolean) => {
        simRef.current?.toggleLink(linkId, disabled);
      },
      setEndpoints: (source: string, destination: string) => {
        if (!simRef.current) return;
        simRef.current.setSource(source);
        simRef.current.setDestination(destination);
      },
      runDemo: () => {
        if (!simRef.current) return;
        timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
        timeoutsRef.current = [];
        const schedule = (delay: number, action: () => void) => {
          const id = window.setTimeout(action, delay);
          timeoutsRef.current.push(id);
        };

        onNarration("Normal flow: packets glide across the best path.");
        schedule(2000, () => {
          const target = simRef.current?.links[2];
          if (target) {
            simRef.current?.updateLink(target.id, { delayMs: 220, bandwidth: 10 });
            onNarration("Congestion rising on a key link, packets slow down.");
          }
        });
        schedule(5000, () => {
          const target = simRef.current?.links[4];
          if (target) {
            simRef.current?.toggleLink(target.id, true);
            onNarration(
              "A critical link failed. Auto-reroute finds an alternate path."
            );
          }
        });
        schedule(8000, () => {
          simRef.current?.links.forEach((link) => {
            simRef.current?.updateLink(link.id, {
              delayMs: 60,
              lossRate: 0.02,
              bandwidth: 22
            });
            simRef.current?.toggleLink(link.id, false);
          });
          onNarration("Recovery complete. Paths stabilize and speed returns.");
        });
      },
      runChaos: () => {
        if (!simRef.current) return;
        onNarration("Chaos mode: random impairments for 10 seconds.");
        simRef.current.runChaosMode(10000);
      }
    }));

    useEffect(() => {
      if (!simRef.current) return;
      simRef.current.width = dimensions.width;
      simRef.current.height = dimensions.height;
    }, [dimensions]);

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full rounded-[32px] overflow-hidden border border-white/10 bg-night-2/60"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleClick}
          className="w-full h-full"
        />
        <div className="absolute bottom-4 left-4 glass rounded-2xl px-4 py-2 text-xs text-white/70">
          Click a link to adjust. Click a node to set source → destination.
        </div>
      </div>
    );
  }
);

NetworkCanvas.displayName = "NetworkCanvas";

function renderScene(
  ctx: CanvasRenderingContext2D,
  sim: NetworkSimulation,
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(11, 15, 31, 0.9)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(width, height);
  ctx.translate(-0.5, -0.5);

  const path = sim.computeBestPath().path;

  for (const link of sim.links) {
    const from = sim.nodes.find((node) => node.id === link.from);
    const to = sim.nodes.find((node) => node.id === link.to);
    if (!from || !to) continue;
    const glow = link.disabled ? "rgba(255, 80, 80, 0.6)" : "rgba(82,247,255,0.5)";
    ctx.strokeStyle = glow;
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    if (sim.showPaths && path.includes(link.id)) {
      ctx.strokeStyle = "rgba(255, 94, 219, 0.8)";
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    const midX = lerp(from.x, to.x, 0.55);
    const midY = lerp(from.y, to.y, 0.55);
    const dirX = to.x - from.x;
    const dirY = to.y - from.y;
    const length = Math.hypot(dirX, dirY) || 1;
    const arrowX = midX + (dirX / length) * 0.02;
    const arrowY = midY + (dirY / length) * 0.02;
    ctx.fillStyle = "rgba(82,247,255,0.8)";
    ctx.beginPath();
    ctx.arc(arrowX, arrowY, 0.008, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const node of sim.nodes) {
    ctx.fillStyle = "rgba(82,247,255,0.2)";
    ctx.beginPath();
    ctx.arc(node.x, node.y, 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(82,247,255,0.9)";
    ctx.lineWidth = 0.004;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "0.05px Inter";
    ctx.textAlign = "center";
    ctx.fillText(node.id, node.x, node.y + 0.015);
  }

  for (const packet of sim.packets) {
    const linkId = packet.path[packet.edgeIndex];
    const link = sim.links.find((edge) => edge.id === linkId);
    if (!link) continue;
    const from = sim.nodes.find((node) => node.id === link.from);
    const to = sim.nodes.find((node) => node.id === link.to);
    if (!from || !to) continue;
    const x = lerp(from.x, to.x, packet.progress);
    const y = lerp(from.y, to.y, packet.progress);
    ctx.fillStyle = packet.dropped
      ? `rgba(255, 90, 90, ${packet.dropFade})`
      : "rgba(82,247,255,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 0.012, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export default NetworkCanvas;
