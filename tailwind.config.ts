import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "neon-cyan": "#52f7ff",
        "neon-pink": "#ff5edb",
        "neon-purple": "#7b5cff",
        "signal-green": "#4ade80",
        "signal-yellow": "#facc15",
        "signal-red": "#fb7185",
        "signal-gray": "#94a3b8",
        "night": "#0b0f1f",
        "night-2": "#12182d"
      },
      boxShadow: {
        glow: "0 0 24px rgba(82, 247, 255, 0.3)",
        soft: "0 20px 60px rgba(5, 10, 24, 0.4)"
      },
      backgroundImage: {
        "radial-soft": "radial-gradient(circle at top, rgba(82,247,255,0.12), transparent 60%)",
        "panel-glass": "linear-gradient(135deg, rgba(20,28,48,0.92), rgba(10,14,30,0.78))"
      }
    }
  },
  plugins: []
};

export default config;
