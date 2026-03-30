"use client";

import { useEffect, useState, useCallback } from "react";
import type { Group, GroupCreate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GroupForm } from "@/components/groups/group-form";
import { Plus, Users, Pencil, Archive } from "lucide-react";
import { totalRounds } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function GroupsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [groups, setGroups] = useState<Group[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const load = useCallback(() => {
    fetch("/api/groups").then((r) => r.json()).then(setGroups);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: GroupCreate) => {
    if (editingGroup) {
      await fetch(`/api/groups/${editingGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setDialogOpen(false);
    setEditingGroup(null);
    load();
  };

  const handleArchive = async (id: string) => {
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    load();
  };

  const activeGroups = groups.filter((g) => !g.archived);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Groups</h1>
          <p className="text-sm text-neutral-400">{activeGroups.length} configured panels</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingGroup(null); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> New Group
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeGroups.map((group) => (
          <Card key={group.id} className="transition-colors hover:border-neutral-700">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  {group.description && (
                    <CardDescription className="mt-1">{group.description}</CardDescription>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingGroup(group); setDialogOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchive(group.id)}>
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-300">{group.agents.length} agents</span>
                  <span className="text-xs text-neutral-500">
                    ({totalRounds(group.phase_config)} rounds)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.agents.map((agent, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md bg-neutral-800/50 px-2.5 py-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.color || "#666" }} />
                      <span className="text-xs font-medium">{agent.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{agent.role}</Badge>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  {(["diverge", "challenge", "converge"] as const).map((phase) => (
                    <Badge key={phase} variant="secondary" className="text-[10px]">
                      {phase} x{group.phase_config[phase]}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {activeGroups.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-neutral-500">
              <Users className="mx-auto mb-2 h-8 w-8" />
              <p>No groups configured. Create your first agent panel.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "New Group"}</DialogTitle>
            <DialogDescription>
              Configure a panel of agents with distinct roles and personalities.
            </DialogDescription>
          </DialogHeader>
          <GroupForm
            initial={editingGroup || undefined}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
