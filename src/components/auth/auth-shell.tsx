"use client";

import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "./auth-gate";
import { SpectatorBanner } from "./spectator-banner";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-amber-400" />
      </div>
    );
  }

  if (!role) {
    return <AuthGate />;
  }

  return (
    <>
      {role === "spectator" && <SpectatorBanner />}
      {children}
    </>
  );
}
