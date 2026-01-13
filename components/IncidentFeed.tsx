"use client";

import { Badge } from "./ui/badge";

interface IncidentFeedProps {
  incidents: {
    id: string;
    message: string;
    severity: "INFO" | "WARN" | "CRIT";
    timestamp: number;
  }[];
}

const severityMap = {
  INFO: "info",
  WARN: "warn",
  CRIT: "crit"
} as const;

export default function IncidentFeed({ incidents }: IncidentFeedProps) {
  return (
    <section className="glass rounded-3xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Incident Feed</h2>
        <p className="text-sm text-white/60">
          Human-readable network events with severity.
        </p>
      </div>
      <div className="space-y-3 max-h-[260px] overflow-auto pr-2">
        {incidents.length === 0 ? (
          <p className="text-sm text-white/40">No incidents yet.</p>
        ) : (
          incidents.map((incident) => (
            <div
              key={incident.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                <Badge variant={severityMap[incident.severity]}>
                  {incident.severity}
                </Badge>
              </div>
              <p className="text-sm text-white/80">{incident.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
