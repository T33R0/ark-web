"use client";

import Link from "next/link";
import type { Session } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { truncate, timeAgo } from "@/lib/utils";
import { MessageSquare, Clock, Users } from "lucide-react";

interface SessionCardProps {
  session: Session;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "destructive" | "outline" | "secondary"> = {
  running: "warning",
  completed: "success",
  pending: "info",
  stopped: "secondary",
  error: "destructive",
};

export function SessionCard({ session }: SessionCardProps) {
  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="cursor-pointer transition-colors hover:border-neutral-700">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-medium leading-snug">
              {truncate(session.topic, 80)}
            </CardTitle>
            <Badge variant={STATUS_VARIANT[session.status] || "outline"} className="ml-2 shrink-0">
              {session.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            {session.group_snapshot && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{session.group_snapshot.agents?.length || 0} agents</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>Round {session.current_round}/{session.max_rounds}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{timeAgo(session.created_at)}</span>
            </div>
          </div>
          {session.group_snapshot && (
            <div className="mt-2 flex gap-1">
              {session.group_snapshot.agents?.map((a: { name: string; color?: string }, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {a.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
