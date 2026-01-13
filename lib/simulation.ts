import {
  Link,
  MetricsSnapshot,
  Node,
  Packet,
  SimulationSettings,
  User,
  WorldRegion
} from "./types";
import { clamp, mulberry32 } from "./utils";

export interface SimulationConfig {
  width: number;
  height: number;
  seed: number;
  onIncident?: (message: string, severity: "INFO" | "WARN" | "CRIT") => void;
  onReroute?: (message: string) => void;
}

interface RouteResult {
  path: string[];
  cost: number;
}

export class NetworkSimulation {
  nodes: Node[] = [];
  links: Link[] = [];
  packets: Packet[] = [];
  users: User[] = [];
  rng: () => number;
  width: number;
  height: number;
  running = true;
  sourceId: string;
  destinationId: string;
  autoReroute = true;
  showPaths = true;
  globalRouting = true;

  private onIncident?: (message: string, severity: "INFO" | "WARN" | "CRIT") => void;
  private onReroute?: (message: string) => void;
  private nextUserId = 0;
  private serverLoadBoost: Record<string, number> = {};

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
    this.onIncident = config.onIncident;
    this.onReroute = config.onReroute;
    this.nodes = this.createNodes();
    this.links = this.createLinks();
    this.sourceId = this.nodes[0].id;
    this.destinationId = this.nodes[this.nodes.length - 1].id;
    this.users = this.createUsers();
  }

  reset(seed = 1234) {
    this.rng = mulberry32(seed);
    this.nodes = this.createNodes();
    this.links = this.createLinks();
    this.packets = [];
    this.nextUserId = 0;
    this.serverLoadBoost = {};
    this.users = this.createUsers();
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
    this.globalRouting = settings.globalRouting;
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

  setServerStatus(serverId: string, isUp: boolean) {
    const target = this.nodes.find((node) => node.id === serverId);
    if (target && target.type === "SERVER") {
      target.isUp = isUp;
      this.onIncident?.(
        `${target.label} ${isUp ? "restored" : "down"} — reroute triggered.`,
        isUp ? "INFO" : "CRIT"
      );
      this.onReroute?.(
        `${target.label} ${isUp ? "restored" : "down"} — reroute triggered.`
      );
    }
  }

  addServerLoad(serverId: string, extraLoad: number) {
    this.serverLoadBoost[serverId] =
      (this.serverLoadBoost[serverId] ?? 0) + extraLoad;
    this.onIncident?.(
      `Manual load injected on ${serverId} (+${extraLoad}).`,
      "WARN"
    );
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
    this.updateUsers(delta);
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
    const userCountsByServer: Record<string, number> = {};
    const avgLatencyByRegion: Record<WorldRegion, number> = {
      INDIA: 0,
      USA: 0,
      EUROPE: 0,
      ASIA_PACIFIC: 0
    };
    const regionCounts: Record<WorldRegion, number> = {
      INDIA: 0,
      USA: 0,
      EUROPE: 0,
      ASIA_PACIFIC: 0
    };
    const serverHealth: Record<string, "UP" | "DOWN" | "DEGRADED"> = {};

    const servers = this.nodes.filter((node) => node.type === "SERVER");
    servers.forEach((server) => {
      userCountsByServer[server.id] = 0;
      const capacity = server.capacity ?? 0;
      const currentLoad = server.currentLoad ?? 0;
      if (!server.isUp) serverHealth[server.id] = "DOWN";
      else if (capacity > 0 && currentLoad / capacity > 0.9)
        serverHealth[server.id] = "DEGRADED";
      else serverHealth[server.id] = "UP";
    });

    this.users.forEach((user) => {
      if (user.connectedServerId) {
        userCountsByServer[user.connectedServerId] =
          (userCountsByServer[user.connectedServerId] ?? 0) + 1;
      }
      regionCounts[user.region] += 1;
      avgLatencyByRegion[user.region] += user.lastLatency;
    });

    (Object.keys(avgLatencyByRegion) as WorldRegion[]).forEach((region) => {
      const count = regionCounts[region];
      avgLatencyByRegion[region] = count === 0 ? 0 : avgLatencyByRegion[region] / count;
    });

    return {
      deliveryRate,
      avgLatency,
      sentPerSecond: this.sentPerSecond,
      dropped: this.packetsDropped,
      delivered: this.packetsDelivered,
      bestPathLength: this.computeBestPath().path.length,
      history: this.history,
      userCountsByServer,
      avgLatencyByRegion,
      serverHealth
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

  private updateUsers(delta: number) {
    if (!this.globalRouting) return;
    const servers = this.nodes.filter((node) => node.type === "SERVER");
    servers.forEach((server) => {
      server.currentLoad = this.serverLoadBoost[server.id] ?? 0;
    });

    for (const user of this.users) {
      const { serverId, cost } = this.selectBestServer(user.region);
      if (serverId && user.connectedServerId !== serverId) {
        const message = `Reroute: ${user.region} → ${serverId} (best cost ${Math.round(
          cost
        )}ms)`;
        this.onIncident?.(message, "INFO");
        this.onReroute?.(message);
        user.connectedServerId = serverId;
      } else if (!serverId && user.connectedServerId) {
        this.onIncident?.(
          `Server unavailable for ${user.region} — users waiting.`,
          "WARN"
        );
        user.connectedServerId = null;
      }

      if (user.connectedServerId) {
        const server = servers.find((node) => node.id === user.connectedServerId);
        if (server) {
          server.currentLoad = (server.currentLoad ?? 0) + 1;
          const baseLatency = this.getRegionLatency(user.region, server.region);
          const load = server.currentLoad ?? 0;
          const capacity = server.capacity ?? 1;
          const congestionPenalty = Math.max(0, (load / capacity - 0.7) * 120);
          user.lastLatency = baseLatency + congestionPenalty;
        }
      } else {
        user.lastLatency = 0;
      }
    }

    const overloaded = servers.filter(
      (server) =>
        server.isUp &&
        server.capacity &&
        server.currentLoad &&
        server.currentLoad / server.capacity > 0.95
    );
    if (overloaded.length > 0 && this.rng() < delta * 0.5) {
      this.onIncident?.(
        `Server load high on ${overloaded[0].id} — rerouting users.`,
        "WARN"
      );
    }
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

  selectBestServer(userRegion: WorldRegion) {
    const servers = this.nodes.filter((node) => node.type === "SERVER");
    let best: { serverId: string | null; cost: number } = {
      serverId: null,
      cost: Infinity
    };

    for (const server of servers) {
      if (!server.isUp || !server.region) continue;
      // CDN/Anycast: users connect to the server with lowest latency + congestion cost.
      const baseLatency = this.getRegionLatency(userRegion, server.region);
      const capacity = server.capacity ?? 1;
      const load = server.currentLoad ?? 0;
      const congestionPenalty = Math.max(0, (load / capacity) * 120);
      const cost = baseLatency + congestionPenalty;
      if (cost < best.cost) {
        best = { serverId: server.id, cost };
      }
    }

    return best;
  }

  getRegionLatency(from: WorldRegion, to: WorldRegion) {
    const matrix: Record<WorldRegion, Record<WorldRegion, number>> = {
      INDIA: { INDIA: 30, USA: 250, EUROPE: 150, ASIA_PACIFIC: 90 },
      USA: { USA: 35, INDIA: 250, EUROPE: 120, ASIA_PACIFIC: 180 },
      EUROPE: { EUROPE: 35, INDIA: 150, USA: 120, ASIA_PACIFIC: 160 },
      ASIA_PACIFIC: { ASIA_PACIFIC: 40, INDIA: 90, USA: 180, EUROPE: 160 }
    };
    return matrix[from][to];
  }

  private createNodes(): Node[] {
    return [
      { id: "A", label: "Router A", x: 0.1, y: 0.25, type: "ROUTER" },
      { id: "B", label: "Router B", x: 0.35, y: 0.15, type: "ROUTER" },
      {
        id: "C",
        label: "Server Europe",
        x: 0.6,
        y: 0.2,
        type: "SERVER",
        region: "EUROPE",
        capacity: 140,
        currentLoad: 0,
        isUp: true
      },
      { id: "D", label: "Router D", x: 0.2, y: 0.55, type: "ROUTER" },
      {
        id: "E",
        label: "Server India",
        x: 0.5,
        y: 0.6,
        type: "SERVER",
        region: "INDIA",
        capacity: 160,
        currentLoad: 0,
        isUp: true
      },
      {
        id: "F",
        label: "Server USA",
        x: 0.8,
        y: 0.45,
        type: "SERVER",
        region: "USA",
        capacity: 150,
        currentLoad: 0,
        isUp: true
      }
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

  private createUsers(): User[] {
    const regions: WorldRegion[] = ["INDIA", "USA", "EUROPE", "ASIA_PACIFIC"];
    const users: User[] = [];
    regions.forEach((region) => {
      const count = region === "INDIA" ? 60 : region === "USA" ? 45 : 35;
      for (let i = 0; i < count; i += 1) {
        users.push({
          userId: this.nextUserId++,
          region,
          connectedServerId: null,
          lastLatency: 0
        });
      }
    });
    return users;
  }
}
