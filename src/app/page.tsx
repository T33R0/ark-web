"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, Question, Group } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SessionCard } from "@/components/sessions/session-card";
import { MessageSquare, HelpCircle, Users, Zap, Play, Plus } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    fetch("/api/sessions").then((r) => r.json()).then(setSessions);
    fetch("/api/questions").then((r) => r.json()).then(setQuestions);
    fetch("/api/groups").then((r) => r.json()).then(setGroups);
  }, []);

  const activeSessions = sessions.filter((s) => s.status === "running");
  const recentSessions = sessions.slice(0, 6);
  const activeQuestions = questions.filter((q) => !q.archived);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const question = questions.find((q) => q.id === selectedQuestion);
      const group = groups.find((g) => g.id === selectedGroup);
      if (!group) return;

      const topic = customTopic || question?.prompt || "";
      if (!topic) return;

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          group_id: group.id,
          question_id: (selectedQuestion && selectedQuestion !== "__custom__") ? selectedQuestion : undefined,
          max_rounds: question?.recommended_rounds || (group.phase_config.diverge + group.phase_config.challenge + group.phase_config.converge),
        }),
      });
      const session = await res.json();

      // Start the session
      fetch(`/api/sessions/${session.id}/run`, { method: "POST" });

      router.push(`/sessions/${session.id}`);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-neutral-400">Multi-agent discussion platform</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Sessions", value: sessions.length, icon: MessageSquare, color: "text-blue-400" },
          { label: "Active Now", value: activeSessions.length, icon: Zap, color: "text-amber-400" },
          { label: "Questions", value: activeQuestions.length, icon: HelpCircle, color: "text-green-400" },
          { label: "Groups", value: groups.length, icon: Users, color: "text-violet-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-neutral-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Launch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-green-400" />
            Quick Launch
          </CardTitle>
          <CardDescription>Start a new discussion session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Question (or type custom below)</label>
                <Select value={selectedQuestion} onValueChange={(v) => { setSelectedQuestion(v); setCustomTopic(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a question..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">Custom topic</SelectItem>
                    {activeQuestions.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.prompt.length > 80 ? q.prompt.slice(0, 80) + "..." : q.prompt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-400">Group</label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.agents.length} agents)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(!selectedQuestion || selectedQuestion === "__custom__") && (
              <Textarea
                placeholder="Type a custom topic or question..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                rows={2}
              />
            )}
            <Button
              onClick={handleLaunch}
              disabled={launching || !selectedGroup || ((!selectedQuestion || selectedQuestion === "__custom__") && !customTopic)}
            >
              <Zap className="mr-1 h-4 w-4" />
              {launching ? "Launching..." : "Launch Session"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-dot" />
            Active Sessions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeSessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/sessions")}>
            View all
          </Button>
        </div>
        {recentSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              <MessageSquare className="mx-auto mb-2 h-8 w-8" />
              <p>No sessions yet. Launch your first discussion above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
