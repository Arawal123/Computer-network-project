"use client";

import { useEffect, useRef } from "react";
import { MetricsSnapshot } from "../lib/types";

interface MetricsPanelProps {
  metrics: MetricsSnapshot;
}

export default function MetricsPanel({ metrics }: MetricsPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(82, 247, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.history.forEach((value, index) => {
      const x = (index / Math.max(metrics.history.length - 1, 1)) * width;
      const y = height - (value / 100) * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(82, 247, 255, 0.2)";
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }, [metrics.history]);

  return (
    <section className="glass rounded-3xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Live Metrics</h2>
        <p className="text-sm text-white/60">
          Track delivery, latency, and reroute efficiency.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Metric label="Delivery rate" value={`${metrics.deliveryRate.toFixed(1)}%`} />
        <Metric label="Avg latency" value={`${metrics.avgLatency.toFixed(0)} ms`} />
        <Metric label="Packets sent/sec" value={`${metrics.sentPerSecond}`} />
        <Metric label="Packets dropped" value={`${metrics.dropped}`} />
        <Metric
          label="Current best path"
          value={`${metrics.bestPathLength} hops`}
        />
        <Metric label="Delivered" value={`${metrics.delivered}`} />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60">Delivery trend</span>
          <span className="text-xs text-white/40">Last 40s</span>
        </div>
        <canvas ref={canvasRef} width={240} height={80} className="w-full" />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
