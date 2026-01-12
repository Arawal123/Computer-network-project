export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-night-2/80 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-neon-cyan/20 border border-neon-cyan/50 shadow-glow flex items-center justify-center">
          <span className="text-neon-cyan font-semibold">PR</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            PulseRoute Studio
          </p>
          <h1 className="text-xl font-semibold text-white">
            Live Network Reroute Console
          </h1>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-3 text-xs text-white/60">
        <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
          Real-time Routing
        </span>
        <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
          Canvas 2D
        </span>
        <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
          Deterministic Seeds
        </span>
      </div>
    </header>
  );
}
