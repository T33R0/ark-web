import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationHandler } from "@/components/notifications";
import { AuthProvider } from "@/lib/auth-context";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Ark — Multi-Agent Discussion Platform",
  description: "Orchestrate structured AI discussions with configurable agent panels",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ark",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        <AuthProvider>
          <AuthShell>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto pt-14 md:pt-0">
                {children}
              </main>
              <NotificationHandler />
            </div>
          </AuthShell>
        </AuthProvider>
      </body>
    </html>
  );
}
