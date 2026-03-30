"use client";

import { useState } from "react";
import { Eye, X, Send, CheckCircle } from "lucide-react";

export function SpectatorBanner() {
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", reason: "", use_case: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.reason.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch {
      setError("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-center gap-2 bg-blue-600/20 border-b border-blue-500/30 px-4 py-1.5 text-xs">
        <Eye className="h-3 w-3 text-blue-400" />
        <span className="text-blue-300 font-medium">Spectator Mode</span>
        <span className="text-blue-400/60 mx-1">|</span>
        <button
          onClick={() => { setShowModal(true); setSubmitted(false); }}
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
        >
          Contact administration for access
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <h2 className="text-sm font-semibold">Request Access</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <p className="text-sm text-neutral-300">Request submitted. You'll hear back soon.</p>
                <button
                  onClick={() => setShowModal(false)}
                  className="mt-2 rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-blue-500/50"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-blue-500/50"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">Reason for wanting access</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    required
                    rows={2}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none resize-none placeholder:text-neutral-600 focus:border-blue-500/50"
                    placeholder="Why do you need access?"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">What will you use it for?</label>
                  <textarea
                    value={form.use_case}
                    onChange={(e) => setForm({ ...form, use_case: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none resize-none placeholder:text-neutral-600 focus:border-blue-500/50"
                    placeholder="Describe your intended use"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || !form.name.trim() || !form.email.trim() || !form.reason.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
