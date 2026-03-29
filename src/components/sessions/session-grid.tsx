"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@/lib/types";
import { MessageFeed } from "./message-feed";
import { Badge } from "@/components/ui/badge";
import { truncate } from "@/lib/utils";

interface SessionGridProps {
  sessionIds: string[];
}

export function SessionGrid({ sessionIds }: SessionGridProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (sessionIds.length === 0) return;

    supabase
      .from("ark_sessions")
      .select("*")
      .in("id", sessionIds)
      .then(({ data }) => {
        if (data) setSessions(data as Session[]);
      });

    const channel = supabase
      .channel("session-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ark_sessions" },
        (payload) => {
          setSessions((prev) =>
            prev.map((s) => (s.id === payload.new.id ? { ...s, ...payload.new } as Session : s))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionIds]);

  const cols = sessionIds.length <= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className={`grid gap-4 ${cols}`}>
      {sessions.map((session) => (
        <div key={session.id} className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{truncate(session.topic, 60)}</p>
              <p className="text-xs text-neutral-500">{session.group_snapshot?.name}</p>
            </div>
            <Badge
              variant={session.status === "running" ? "warning" : session.status === "completed" ? "success" : "outline"}
              className="ml-2 shrink-0"
            >
              R{session.current_round}/{session.max_rounds}
            </Badge>
          </div>
          <div className="flex-1">
            <MessageFeed sessionId={session.id} compact />
          </div>
        </div>
      ))}
    </div>
  );
}
