import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "CoreStay", description: "Platform operasional dan manajemen hotel." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
