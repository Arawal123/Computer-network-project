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
import { AnimatePresence, motion } from "framer-motion";
import { NetworkSimulation } from "../lib/simulation";
import { LinkSelection, MetricsSnapshot, SimulationSettings } from "../lib/types";
import { distanceToSegment, lerp } from "../lib/utils";

export interface NetworkCanvasHandle {
  setRunning: (running: boolean) => void;
  reset: (seed: number) => void;
  randomize: () => void;
  updateLink: (linkId: string, changes: Partial<LinkState>) => void;
  toggleLink: (linkId: string, disabled: boolean) => void;
  setServerStatus: (serverId: string, isUp: boolean) => void;
  addServerLoad: (serverId: string, amount: number) => void;
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
  onIncident: (message: string, severity: "INFO" | "WARN" | "CRIT") => void;
}

const NetworkCanvas = forwardRef<NetworkCanvasHandle, NetworkCanvasProps>(
  ({ running, settings, onSelectLink, onMetrics, onNarration, onIncident }, ref) => {
    const globalCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const networkCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const simRef = useRef<NetworkSimulation | null>(null);
    const frameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const timeoutsRef = useRef<number[]>([]);
    const pendingSourceRef = useRef<string | null>(null);
    const reroutePulseRef = useRef<number | null>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [rerouteMessage, setRerouteMessage] = useState<string | null>(null);
    const [rerouteFlash, setRerouteFlash] = useState(false);

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
      if (!globalCanvasRef.current || !networkCanvasRef.current) return;
      simRef.current = new NetworkSimulation({
        width: dimensions.width,
        height: dimensions.height,
        seed: settingsMemo.seed,
        onIncident,
        onReroute: (message) => {
          setRerouteMessage(message);
          setRerouteFlash(true);
          reroutePulseRef.current = performance.now();
          window.setTimeout(() => setRerouteFlash(false), 350);
        }
      });
      simRef.current.setSettings(settingsMemo);
    }, [dimensions.height, dimensions.width, onIncident, settingsMemo]);

    useEffect(() => {
      initSimulation();
    }, [initSimulation]);

    useEffect(() => {
      if (simRef.current) {
        simRef.current.setSettings(settingsMemo);
      }
    }, [settingsMemo]);

    useEffect(() => {
      if (!rerouteMessage) return;
      const timeout = window.setTimeout(() => setRerouteMessage(null), 2400);
      return () => window.clearTimeout(timeout);
    }, [rerouteMessage]);

    useEffect(() => {
      if (simRef.current) {
        simRef.current.running = running;
      }
    }, [running]);

    const animate = useCallback(
      (time: number) => {
        if (!globalCanvasRef.current || !networkCanvasRef.current || !simRef.current)
          return;
        const globalCtx = globalCanvasRef.current.getContext("2d");
        const networkCtx = networkCanvasRef.current.getContext("2d");
        if (!globalCtx || !networkCtx) return;
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        simRef.current.update(delta);
        renderGlobalView(
          globalCtx,
          simRef.current,
          dimensions.width,
          dimensions.height / 2,
          time
        );
        renderNetworkView(
          networkCtx,
          simRef.current,
          dimensions.width,
          dimensions.height / 2,
          time,
          reroutePulseRef.current
        );
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
        if (!networkCanvasRef.current || !simRef.current) return;
        const rect = networkCanvasRef.current.getBoundingClientRect();
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
      setServerStatus: (serverId: string, isUp: boolean) => {
        simRef.current?.setServerStatus(serverId, isUp);
      },
      addServerLoad: (serverId: string, amount: number) => {
        simRef.current?.addServerLoad(serverId, amount);
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
        <div className="grid grid-rows-2 h-full">
          <canvas
            ref={globalCanvasRef}
            width={dimensions.width}
            height={dimensions.height / 2}
            className="w-full h-full"
          />
          <canvas
            ref={networkCanvasRef}
            width={dimensions.width}
            height={dimensions.height / 2}
            onClick={handleClick}
            className="w-full h-full"
          />
        </div>
        <AnimatePresence>
          {rerouteMessage ? (
            <motion.div
              key={rerouteMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-night/80 px-4 py-2 text-xs text-white/80 backdrop-blur-xl"
            >
              {rerouteMessage}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {rerouteFlash ? (
          <div className="pointer-events-none absolute inset-0 bg-white/5 animate-pulse" />
        ) : null}
        <div className="absolute bottom-4 left-4 glass rounded-2xl px-4 py-2 text-xs text-white/70">
          Click a link to adjust. Click a node to set source → destination.
        </div>
      </div>
    );
  }
);

NetworkCanvas.displayName = "NetworkCanvas";

const REGION_POSITIONS = {
  INDIA: { x: 0.7, y: 0.5 },
  USA: { x: 0.25, y: 0.35 },
  EUROPE: { x: 0.5, y: 0.32 },
  ASIA_PACIFIC: { x: 0.82, y: 0.35 }
};

function renderGlobalView(
  ctx: CanvasRenderingContext2D,
  sim: NetworkSimulation,
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(8, 12, 26, 0.95)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.scale(width, height);

  ctx.fillStyle = "rgba(82, 247, 255, 0.04)";
  ctx.beginPath();
  ctx.ellipse(0.45, 0.45, 0.45, 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  const servers = sim.nodes.filter((node) => node.type === "SERVER");
  const usersByRegion = sim.users.reduce<Record<string, number>>((acc, user) => {
    acc[user.region] = (acc[user.region] ?? 0) + 1;
    return acc;
  }, {});

  sim.users.slice(0, 120).forEach((user) => {
    const origin = REGION_POSITIONS[user.region];
    if (!origin || !user.connectedServerId) return;
    const server = servers.find((node) => node.id === user.connectedServerId);
    if (!server || !server.region) return;
    const target = REGION_POSITIONS[server.region];
    if (!target) return;
    const midX = (origin.x + target.x) / 2 + (origin.x - target.x) * 0.08;
    const midY = (origin.y + target.y) / 2 - 0.08;
    const latency = user.lastLatency;
    ctx.strokeStyle =
      latency < 120
        ? "rgba(74, 222, 128, 0.4)"
        : latency < 200
          ? "rgba(250, 204, 21, 0.4)"
          : "rgba(251, 113, 133, 0.4)";
    ctx.lineWidth = 0.002;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.quadraticCurveTo(midX, midY, target.x, target.y);
    ctx.stroke();
  });

  Object.entries(REGION_POSITIONS).forEach(([region, pos], index) => {
    const users = usersByRegion[region] ?? 0;
    const offset = (index % 2 === 0 ? 0.02 : -0.02) * (1 + index * 0.1);
    ctx.fillStyle = "rgba(82,247,255,0.2)";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "0.04px Inter";
    ctx.textAlign = "center";
    ctx.fillText(region.replace("_", "-"), pos.x, pos.y - 0.05 + offset);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "0.03px Inter";
    ctx.fillText(`${users} users`, pos.x, pos.y + 0.06 + offset);
  });

  servers.forEach((server) => {
    if (!server.region) return;
    const pos = REGION_POSITIONS[server.region];
    if (!pos) return;
    const pulse = 0.04 + Math.sin(time / 600 + pos.x * 3) * 0.003;
    ctx.fillStyle = server.isUp ? "rgba(123, 92, 255, 0.25)" : "rgba(148,163,184,0.2)";
    ctx.beginPath();
    ctx.arc(pos.x + 0.05, pos.y + 0.08, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = server.isUp ? "rgba(123,92,255,0.9)" : "rgba(148,163,184,0.6)";
    ctx.lineWidth = 0.004;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "0.03px Inter";
    ctx.fillText(server.id, pos.x + 0.05, pos.y + 0.085);
  });

  ctx.restore();
}

function renderNetworkView(
  ctx: CanvasRenderingContext2D,
  sim: NetworkSimulation,
  width: number,
  height: number,
  time: number,
  reroutePulseAt: number | null
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(11, 15, 31, 0.9)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(width, height);
  ctx.translate(-0.5, -0.5);

  const path = sim.computeBestPath().path;

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
      : "rgba(82,247,255,0.65)";
    ctx.beginPath();
    ctx.arc(x, y, 0.01, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const link of sim.links) {
    const from = sim.nodes.find((node) => node.id === link.from);
    const to = sim.nodes.find((node) => node.id === link.to);
    if (!from || !to) continue;
    const utilization = Math.min(sim.getLinkLoad(link.id) / link.capacity, 1.4);
    const pulse = utilization > 1 ? 0.5 + Math.sin(time / 150) * 0.2 : 0;
    const glow = link.disabled
      ? "rgba(251, 113, 133, 0.6)"
      : `rgba(82,247,255,${0.25 + utilization * 0.35 + pulse})`;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    if (sim.showPaths && path.includes(link.id)) {
      ctx.strokeStyle = "rgba(255, 94, 219, 0.8)";
      ctx.lineWidth = 0.008;
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

  if (reroutePulseAt && time - reroutePulseAt < 1200 && path.length > 0) {
    const progress = (time - reroutePulseAt) / 1200;
    const pathIndex = Math.floor(progress * path.length);
    const linkId = path[pathIndex];
    const link = sim.links.find((edge) => edge.id === linkId);
    if (link) {
      const from = sim.nodes.find((node) => node.id === link.from);
      const to = sim.nodes.find((node) => node.id === link.to);
      if (from && to) {
        const localProgress = progress * path.length - pathIndex;
        const x = lerp(from.x, to.x, localProgress);
        const y = lerp(from.y, to.y, localProgress);
        ctx.fillStyle = "rgba(82,247,255,0.9)";
        ctx.beginPath();
        ctx.arc(x, y, 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const node of sim.nodes) {
    const isServer = node.type === "SERVER";
    const baseColor = isServer
      ? node.isUp
        ? "rgba(123,92,255,0.35)"
        : "rgba(148,163,184,0.2)"
      : "rgba(82,247,255,0.2)";
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, isServer ? 0.05 : 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isServer
      ? node.isUp
        ? "rgba(123,92,255,0.9)"
        : "rgba(148,163,184,0.7)"
      : "rgba(82,247,255,0.9)";
    ctx.lineWidth = 0.004;
    ctx.stroke();
  }

  for (const node of sim.nodes) {
    const label = node.type === "SERVER" ? `${node.label}` : node.id;
    const padding = 0.012;
    ctx.font = "0.035px Inter";
    const textWidth = ctx.measureText(label).width;
    const pillWidth = textWidth + padding * 2;
    const pillHeight = 0.03;
    const offsetY = node.type === "SERVER" ? -0.075 : -0.06;
    ctx.fillStyle = "rgba(9, 13, 30, 0.7)";
    ctx.beginPath();
    ctx.roundRect(node.x - pillWidth / 2, node.y + offsetY, pillWidth, pillHeight, 0.012);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "center";
    ctx.fillText(label, node.x, node.y + offsetY + 0.022);
  }

  ctx.restore();
}

export default NetworkCanvas;
