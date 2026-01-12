export type NodeId = string;

export interface Node {
  id: NodeId;
  label: string;
  x: number;
  y: number;
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
}
