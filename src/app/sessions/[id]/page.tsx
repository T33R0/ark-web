"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@/lib/types";
import { MessageFeed } from "@/components/sessions/message-feed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Square,
  RotateCcw,
  Copy,
  Archive,
  Users,
  Clock,
  MessageSquare,
} from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "destructive" | "outline" | "secondary"> = {
  running: "warning",
  completed: "success",
  pending: "info",
  stopped: "secondary",
  error: "destructive",
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const [session, setSession] = useState<Session | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then(setSession);

    const channel = supabase
      .channel(`session-detail-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ark_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession((prev) => prev ? { ...prev, ...payload.new } as Session : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const handleStop = async () => {
    setStopping(true);
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "stopped" }),
    });
    setStopping(false);
  };

  const handleRerun = async () => {
    if (!session) return;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: session.topic,
        group_id: session.group_id,
        question_id: session.question_id,
        max_rounds: session.max_rounds,
      }),
    });
    const newSession = await res.json();
    fetch(`/api/sessions/${newSession.id}/run`, { method: "POST" });
    router.push(`/sessions/${newSession.id}`);
  };

  const handleCopyTranscript = async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    // Fetch messages for transcript
    const msgRes = await supabase
      .from("ark_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    if (msgRes.data) {
      const transcript = msgRes.data
        .map((m) => `[Round ${m.round} - ${m.phase}] ${m.agent_name} (${m.agent_role}):\n${m.content}`)
        .join("\n\n");
      const full = `Topic: ${data.topic}\nGroup: ${data.group_snapshot?.name}\n\n${transcript}`;
      navigator.clipboard.writeText(full);
    }
  };

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-neutral-500">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/sessions")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{session.topic}</h1>
              <Badge variant={STATUS_VARIANT[session.status] || "outline"}>
                {session.status}
              </Badge>
              {session.status === "running" && (
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-dot" />
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              {session.group_snapshot && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {session.group_snapshot.name} ({session.group_snapshot.agents?.length} agents)
                </span>
              )}
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Round {session.current_round}/{session.max_rounds}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.current_phase}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {session.status === "running" && (
              <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopping}>
                <Square className="mr-1 h-3 w-3" /> Stop
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRerun}>
              <RotateCcw className="mr-1 h-3 w-3" /> Re-run
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyTranscript}>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageFeed sessionId={sessionId} />
      </div>

      {/* Summary (shown when complete) */}
      {session.status === "completed" && session.summary && (
        <div className="border-t border-neutral-800 px-6 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Session Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-300">{session.summary}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error */}
      {session.status === "error" && session.error_message && (
        <div className="border-t border-neutral-800 px-6 py-4">
          <Card className="border-red-900">
            <CardContent className="p-4">
              <p className="text-sm text-red-400">{session.error_message}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
