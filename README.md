# PulseRoute: Live Network Reroute Studio

A production-ready, client-only Next.js 14 demo for teaching network routing concepts. Watch glowing packets flow across a neon topology, induce congestion and loss, cut links, and see auto-rerouting with live metrics.

## Features
- Real-time packet simulation with delay, loss, and congestion controls.
- Clickable topology: select links to tune, nodes to set endpoints.
- Auto-rerouting, demo scenario narration, and 10-second chaos mode.
- Live delivery/latency metrics plus an on-canvas delivery trend chart.
- Deterministic random seed for reproducible teaching demos.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and run production

```bash
npm run build
npm run start
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. In Vercel, click **New Project** and import the repository.
3. Keep the default settings (Next.js framework detected).
4. Deploy.

No environment variables or server setup required.

## Troubleshooting
- **Blank screen**: Ensure you are running `npm install` before `npm run dev`.
- **Build errors**: Confirm you are on Node 18+ and that no files were moved outside the `/app` directory.
- **Canvas not animating**: Make sure the browser allows requestAnimationFrame and hardware acceleration.

---

Built with Next.js 14, TypeScript, and Tailwind CSS.
