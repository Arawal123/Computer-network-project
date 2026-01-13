"use client";

import { create } from "zustand";
import { LinkSelection, MetricsSnapshot, SimulationSettings } from "./types";

export interface LinkControls {
  delayMs: number;
  lossRate: number;
  bandwidth: number;
  disabled: boolean;
}

const defaultMetrics: MetricsSnapshot = {
  deliveryRate: 100,
  avgLatency: 0,
  sentPerSecond: 0,
  dropped: 0,
  delivered: 0,
  bestPathLength: 0,
  history: [],
  userCountsByServer: {},
  avgLatencyByRegion: {
    INDIA: 0,
    USA: 0,
    EUROPE: 0,
    ASIA_PACIFIC: 0
  },
  serverHealth: {}
};

interface SimulationState {
  running: boolean;
  settings: SimulationSettings;
  seed: number;
  selectedLink: LinkSelection | null;
  linkControls: LinkControls | null;
  narration: string;
  metrics: MetricsSnapshot;
  incidents: {
    id: string;
    message: string;
    severity: "INFO" | "WARN" | "CRIT";
    timestamp: number;
  }[];
  setRunning: (value: boolean) => void;
  setSeed: (value: number) => void;
  setSettings: (settings: Partial<SimulationSettings>) => void;
  setSelectedLink: (link: LinkSelection | null, controls: LinkControls | null) => void;
  setLinkControls: (controls: LinkControls | null) => void;
  setNarration: (text: string) => void;
  setMetrics: (metrics: MetricsSnapshot) => void;
  addIncident: (message: string, severity: "INFO" | "WARN" | "CRIT") => void;
  clearIncidents: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  running: true,
  seed: 1337,
  settings: {
    autoReroute: true,
    showPaths: true,
    seed: 1337,
    globalRouting: true
  },
  selectedLink: null,
  linkControls: null,
  narration: "Click a link to explore. Click two nodes to change the route.",
  metrics: defaultMetrics,
  incidents: [],
  setRunning: (value) => set({ running: value }),
  setSeed: (value) =>
    set((state) => ({
      seed: value,
      settings: { ...state.settings, seed: value }
    })),
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  setSelectedLink: (link, controls) =>
    set({ selectedLink: link, linkControls: controls }),
  setLinkControls: (controls) => set({ linkControls: controls }),
  setNarration: (text) => set({ narration: text }),
  setMetrics: (metrics) => set({ metrics }),
  addIncident: (message, severity) =>
    set((state) => ({
      incidents: [
        {
          id: `${Date.now()}-${state.incidents.length}`,
          message,
          severity,
          timestamp: Date.now()
        },
        ...state.incidents
      ].slice(0, 12)
    })),
  clearIncidents: () => set({ incidents: [] })
}));
