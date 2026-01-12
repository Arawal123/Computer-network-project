import { Link, MetricsSnapshot, Node, Packet, SimulationSettings } from "./types";
import { clamp, mulberry32 } from "./utils";

export interface SimulationConfig {
  width: number;
  height: number;
  seed: number;
}

interface RouteResult {
  path: string[];
  cost: number;
}

export class NetworkSimulation {
  nodes: Node[] = [];
  links: Link[] = [];
  packets: Packet[] = [];
  rng: () => number;
  width: number;
  height: number;
  running = true;
  sourceId: string;
  destinationId: string;
  autoReroute = true;
  showPaths = true;

  private lastPacketId = 0;
  private lastSpawn = 0;
  private packetsSent = 0;
  private packetsDelivered = 0;
  private packetsDropped = 0;
  private latencySum = 0;
  private perSecondCounter = 0;
  private perSecondTimer = 0;
  private sentPerSecond = 0;
  private history: number[] = [];

  constructor(config: SimulationConfig) {
    this.width = config.width;
    this.height = config.height;
    this.rng = mulberry32(config.seed);
    this.nodes = this.createNodes();
    this.links = this.createLinks();
    this.sourceId = this.nodes[0].id;
    this.destinationId = this.nodes[this.nodes.length - 1].id;
  }

  reset(seed = 1234) {
    this.rng = mulberry32(seed);
    this.nodes = this.createNodes();
    this.links = this.createLinks();
    this.packets = [];
    this.lastPacketId = 0;
    this.lastSpawn = 0;
    this.packetsSent = 0;
    this.packetsDelivered = 0;
    this.packetsDropped = 0;
    this.latencySum = 0;
    this.sentPerSecond = 0;
    this.perSecondCounter = 0;
    this.perSecondTimer = 0;
    this.history = [];
    this.sourceId = this.nodes[0].id;
    this.destinationId = this.nodes[this.nodes.length - 1].id;
  }

  setSettings(settings: SimulationSettings) {
    this.autoReroute = settings.autoReroute;
    this.showPaths = settings.showPaths;
    this.rng = mulberry32(settings.seed);
  }

  setSource(id: string) {
    this.sourceId = id;
  }

  setDestination(id: string) {
    this.destinationId = id;
  }

  updateLink(linkId: string, changes: Partial<Link>) {
    const target = this.links.find((link) => link.id === linkId);
    if (!target) return;
    Object.assign(target, changes);
  }

  randomizeTopology() {
    this.nodes = this.nodes.map((node) => ({
      ...node,
      x: 0.15 + this.rng() * 0.7,
      y: 0.15 + this.rng() * 0.7
    }));
  }

  toggleLink(linkId: string, disabled: boolean) {
    const target = this.links.find((link) => link.id === linkId);
    if (target) {
      target.disabled = disabled;
    }
  }

  runChaosMode(durationMs: number) {
    const start = performance.now();
    const chaos = () => {
      const now = performance.now();
      if (now - start > durationMs) {
        this.links.forEach((link) => {
          link.delayMs = 60;
          link.lossRate = 0.02;
          link.bandwidth = 22;
          link.disabled = false;
        });
        return;
      }
      this.links.forEach((link) => {
        link.delayMs = clamp(40 + this.rng() * 160, 20, 240);
        link.lossRate = clamp(this.rng() * 0.18, 0, 0.2);
        link.bandwidth = clamp(10 + this.rng() * 20, 6, 30);
        if (this.rng() < 0.08) {
          link.disabled = true;
        }
      });
      requestAnimationFrame(chaos);
    };
    chaos();
  }

  update(delta: number) {
    if (!this.running) return;

    const path = this.computeBestPath();
    const rate = this.getCurrentRate();
    this.lastSpawn += delta;
    const interval = 1 / rate;

    while (this.lastSpawn > interval) {
      this.lastSpawn -= interval;
      if (path.path.length > 0) {
        this.spawnPacket(path.path);
      }
    }

    this.updatePackets(delta);
    this.updateMetrics(delta, path.path.length);
  }

  getMetrics(): MetricsSnapshot {
    const deliveryRate =
      this.packetsSent === 0
        ? 100
        : (this.packetsDelivered / this.packetsSent) * 100;
    const avgLatency =
      this.packetsDelivered === 0
        ? 0
        : this.latencySum / this.packetsDelivered;

    return {
      deliveryRate,
      avgLatency,
      sentPerSecond: this.sentPerSecond,
      dropped: this.packetsDropped,
      delivered: this.packetsDelivered,
      bestPathLength: this.computeBestPath().path.length,
      history: this.history
    };
  }

  getLinkLoad(linkId: string) {
    return this.packets.filter((packet) => packet.path[packet.edgeIndex] === linkId)
      .length;
  }

  getCurrentRate() {
    const baseRate = 12;
    return clamp(baseRate + this.links.length * 0.8, 10, 20);
  }

  private spawnPacket(path: string[]) {
    const packet: Packet = {
      id: this.lastPacketId++,
      path,
      edgeIndex: 0,
      progress: 0,
      speed: 0.35 + this.rng() * 0.15,
      spawnedAt: performance.now(),
      dropped: false,
      dropFade: 1
    };
    this.packets.push(packet);
    this.packetsSent += 1;
    this.perSecondCounter += 1;
  }

  private updatePackets(delta: number) {
    const alive: Packet[] = [];
    for (const packet of this.packets) {
      if (packet.dropped) {
        packet.dropFade -= delta * 2;
        if (packet.dropFade > 0) {
          alive.push(packet);
        }
        continue;
      }

      const linkId = packet.path[packet.edgeIndex];
      const link = this.links.find((edge) => edge.id === linkId);
      if (!link || link.disabled) {
        if (this.autoReroute) {
          const reroute = this.computeBestPath();
          if (reroute.path.length > 0) {
            packet.path = reroute.path;
            packet.edgeIndex = 0;
            packet.progress = 0;
            alive.push(packet);
            continue;
          }
        }
        packet.dropped = true;
        this.packetsDropped += 1;
        alive.push(packet);
        continue;
      }

      const load = this.getLinkLoad(link.id);
      const congestionFactor = clamp(load / link.capacity, 0.1, 2);
      const speedScale = clamp(1 - congestionFactor * 0.5, 0.2, 1.2);
      const delayScale = clamp(1 + link.delayMs / 120, 1, 3);
      const travel = packet.speed * speedScale / delayScale;

      if (this.rng() < link.lossRate * delta) {
        packet.dropped = true;
        this.packetsDropped += 1;
        alive.push(packet);
        continue;
      }

      packet.progress += travel * delta;

      if (packet.progress >= 1) {
        packet.edgeIndex += 1;
        packet.progress = 0;
        if (packet.edgeIndex >= packet.path.length) {
          this.packetsDelivered += 1;
          this.latencySum += performance.now() - packet.spawnedAt;
          continue;
        }
      }

      alive.push(packet);
    }
    this.packets = alive;
  }

  private updateMetrics(delta: number, pathLength: number) {
    this.perSecondTimer += delta;
    if (this.perSecondTimer >= 1) {
      this.sentPerSecond = this.perSecondCounter;
      this.perSecondCounter = 0;
      this.perSecondTimer = 0;
      const deliveryRate =
        this.packetsSent === 0
          ? 100
          : (this.packetsDelivered / this.packetsSent) * 100;
      this.history.push(deliveryRate);
      if (this.history.length > 40) this.history.shift();
    }

    if (pathLength === 0) {
      this.history.push(0);
    }
  }

  computeBestPath(): RouteResult {
    const nodes = this.nodes.map((node) => node.id);
    const costs: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const visited = new Set<string>();

    for (const node of nodes) {
      costs[node] = Infinity;
      prev[node] = null;
    }
    costs[this.sourceId] = 0;

    const getNeighbors = (nodeId: string) =>
      this.links.filter(
        (link) => !link.disabled && (link.from === nodeId || link.to === nodeId)
      );

    while (visited.size < nodes.length) {
      let current: string | null = null;
      let currentCost = Infinity;
      for (const node of nodes) {
        if (!visited.has(node) && costs[node] < currentCost) {
          current = node;
          currentCost = costs[node];
        }
      }
      if (!current) break;
      visited.add(current);
      if (current === this.destinationId) break;

      for (const link of getNeighbors(current)) {
        const neighbor = link.from === current ? link.to : link.from;
        const congestion = this.getLinkLoad(link.id) / link.capacity;
        const cost =
          link.baseWeight +
          link.delayMs * 0.02 +
          link.lossRate * 20 +
          congestion * 6;
        const newCost = costs[current] + cost;
        if (newCost < costs[neighbor]) {
          costs[neighbor] = newCost;
          prev[neighbor] = current;
        }
      }
    }

    const pathNodes: string[] = [];
    let step: string | null = this.destinationId;
    while (step) {
      pathNodes.unshift(step);
      step = prev[step];
    }

    if (pathNodes[0] !== this.sourceId) {
      return { path: [], cost: Infinity };
    }

    const pathLinks: string[] = [];
    for (let i = 0; i < pathNodes.length - 1; i += 1) {
      const from = pathNodes[i];
      const to = pathNodes[i + 1];
      const link = this.links.find(
        (edge) =>
          (edge.from === from && edge.to === to) ||
          (edge.from === to && edge.to === from)
      );
      if (link) pathLinks.push(link.id);
    }

    return { path: pathLinks, cost: costs[this.destinationId] };
  }

  private createNodes(): Node[] {
    return [
      { id: "A", label: "Router A", x: 0.1, y: 0.25 },
      { id: "B", label: "Router B", x: 0.35, y: 0.15 },
      { id: "C", label: "Router C", x: 0.6, y: 0.2 },
      { id: "D", label: "Router D", x: 0.2, y: 0.55 },
      { id: "E", label: "Router E", x: 0.5, y: 0.6 },
      { id: "F", label: "Router F", x: 0.8, y: 0.45 }
    ];
  }

  private createLinks(): Link[] {
    const base: Omit<Link, "id" | "from" | "to"> = {
      baseWeight: 1,
      delayMs: 60,
      lossRate: 0.02,
      bandwidth: 22,
      capacity: 16,
      disabled: false
    };
    const links = [
      { id: "AB", from: "A", to: "B" },
      { id: "AC", from: "A", to: "D" },
      { id: "BC", from: "B", to: "C" },
      { id: "BD", from: "B", to: "D" },
      { id: "CE", from: "C", to: "E" },
      { id: "DE", from: "D", to: "E" },
      { id: "CF", from: "C", to: "F" },
      { id: "EF", from: "E", to: "F" }
    ];

    return links.map((link, index) => ({
      ...base,
      ...link,
      baseWeight: 1 + index * 0.4
    }));
  }
}
