export type NodeId = string;

export type WorldRegion = "INDIA" | "USA" | "EUROPE" | "ASIA_PACIFIC";

export type NodeType = "ROUTER" | "SERVER";

export interface Node {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  type: NodeType;
  region?: WorldRegion;
  capacity?: number;
  currentLoad?: number;
  isUp?: boolean;
}

export interface Link {
  id: string;
  from: NodeId;
  to: NodeId;
  baseWeight: number;
  delayMs: number;
  lossRate: number;
  bandwidth: number;
  capacity: number;
  disabled: boolean;
}

export interface Packet {
  id: number;
  path: string[];
  edgeIndex: number;
  progress: number;
  speed: number;
  spawnedAt: number;
  dropped: boolean;
  dropFade: number;
}

export interface MetricsSnapshot {
  deliveryRate: number;
  avgLatency: number;
  sentPerSecond: number;
  dropped: number;
  delivered: number;
  bestPathLength: number;
  history: number[];
  userCountsByServer: Record<string, number>;
  avgLatencyByRegion: Record<WorldRegion, number>;
  serverHealth: Record<string, "UP" | "DOWN" | "DEGRADED">;
}

export interface LinkSelection {
  id: string;
  from: string;
  to: string;
}

export interface SimulationSettings {
  autoReroute: boolean;
  showPaths: boolean;
  seed: number;
  globalRouting: boolean;
}

export interface User {
  userId: number;
  region: WorldRegion;
  connectedServerId: string | null;
  lastLatency: number;
}

export interface IncidentEvent {
  id: string;
  message: string;
  severity: "INFO" | "WARN" | "CRIT";
  timestamp: number;
}
