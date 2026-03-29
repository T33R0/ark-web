"use client";

import { useEffect, useState, useCallback } from "react";
import type { Session } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { SessionCard } from "@/components/sessions/session-card";
import { SessionGrid } from "@/components/sessions/session-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutGrid, List, MessageSquare } from "lucide-react";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [view, setView] = useState<"list" | "grid">("list");

  const load = useCallback(() => {
    fetch("/api/sessions").then((r) => r.json()).then(setSessions);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Subscribe to session status changes
  useEffect(() => {
    const channel = supabase
      .channel("session-list-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ark_sessions" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const activeSessions = sessions.filter((s) => s.status === "running");
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const otherSessions = sessions.filter((s) => !["running", "completed"].includes(s.status));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-sm text-neutral-400">
            {activeSessions.length} active, {completedSessions.length} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setView("grid")}
            disabled={activeSessions.length === 0}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "grid" && activeSessions.length > 0 ? (
        <SessionGrid sessionIds={activeSessions.map((s) => s.id)} />
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Active
              {activeSessions.length > 0 && (
                <Badge variant="warning" className="ml-2 text-[10px]">{activeSessions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedSessions.length})</TabsTrigger>
            {otherSessions.length > 0 && (
              <TabsTrigger value="other">Other ({otherSessions.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active">
            {activeSessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-neutral-500">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8" />
                  <p>No active sessions. Launch one from the dashboard.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeSessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {completedSessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </TabsContent>

          {otherSessions.length > 0 && (
            <TabsContent value="other">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherSessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
