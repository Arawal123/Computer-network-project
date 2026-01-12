import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseRoute: Live Network Reroute Studio",
  description:
    "A live, interactive network reroute simulator for teaching routing, congestion, and resilience.",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
