"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Zap, Eye, KeyRound, ArrowRight, AlertCircle } from "lucide-react";

export function AuthGate() {
  const { login, enterSpectator } = useAuth();
  const [mode, setMode] = useState<"choose" | "key">("choose");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setSubmitting(true);
    setError("");
    const ok = await login(key.trim());
    if (!ok) {
      setError("Invalid API key");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-400" />
            <span className="text-3xl font-bold tracking-tight">Ark</span>
          </div>
          <p className="text-sm text-neutral-400">Multi-Agent Discussion Platform</p>
        </div>

        {mode === "choose" ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode("key")}
              className="flex w-full items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-800"
            >
              <KeyRound className="h-5 w-5 text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">Log in</p>
                <p className="text-xs text-neutral-500">Enter your API key for full access</p>
              </div>
              <ArrowRight className="h-4 w-4 text-neutral-600" />
            </button>

            <button
              onClick={enterSpectator}
              className="flex w-full items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-800"
            >
              <Eye className="h-5 w-5 text-blue-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">Spectator mode</p>
                <p className="text-xs text-neutral-500">Browse sessions read-only</p>
              </div>
              <ArrowRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleKeySubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">API Key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(""); }}
                placeholder="ark_..."
                autoFocus
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-amber-500/50"
              />
              {error && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode("choose"); setKey(""); setError(""); }}
                className="rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !key.trim()}
                className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {submitting ? "Validating..." : "Log in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
