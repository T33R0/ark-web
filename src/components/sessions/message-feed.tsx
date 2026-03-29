"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";
import { AGENT_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageFeedProps {
  sessionId: string;
  initialMessages?: Message[];
  compact?: boolean;
}

export function MessageFeed({ sessionId, initialMessages = [], compact = false }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load existing messages
    supabase
      .from("ark_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ark_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build a color map for agent names
  const agentColorMap = new Map<string, string>();
  messages.forEach((msg) => {
    if (!agentColorMap.has(msg.agent_name)) {
      agentColorMap.set(msg.agent_name, AGENT_COLORS[agentColorMap.size % AGENT_COLORS.length]);
    }
  });

  let lastRound = 0;

  return (
    <ScrollArea className={compact ? "h-[300px]" : "h-full"}>
      <div className="space-y-1 p-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-12 text-neutral-500">
            <div className="text-center">
              <div className="mb-2 text-2xl">&#x1f4ac;</div>
              <p className="text-sm">Waiting for messages...</p>
            </div>
          </div>
        )}
        {messages.map((msg) => {
          const showRoundHeader = msg.round !== lastRound;
          lastRound = msg.round;
          const color = agentColorMap.get(msg.agent_name) || "#666";

          return (
            <div key={msg.id}>
              {showRoundHeader && (
                <div className="flex items-center gap-2 py-3">
                  <div className="h-px flex-1 bg-neutral-800" />
                  <span className="text-xs font-medium text-neutral-500">
                    Round {msg.round}
                    {msg.phase && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {msg.phase}
                      </Badge>
                    )}
                  </span>
                  <div className="h-px flex-1 bg-neutral-800" />
                </div>
              )}
              <div className="animate-fade-in rounded-lg p-3 hover:bg-neutral-900/50">
                <div className="mb-1 flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-semibold" style={{ color }}>
                    {msg.agent_name}
                  </span>
                  {msg.agent_role && (
                    <span className="text-xs text-neutral-600">({msg.agent_role})</span>
                  )}
                  <span className="ml-auto text-xs text-neutral-600">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed text-neutral-300 ${compact ? "line-clamp-3" : ""}`}>
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
