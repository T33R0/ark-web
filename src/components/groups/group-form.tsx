"use client";

import { useState, useEffect } from "react";
import type { Agent, GroupCreate, PhaseConfig } from "@/lib/types";
import { AGENT_COLORS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";

interface GroupFormProps {
  initial?: GroupCreate;
  onSave: (group: GroupCreate) => Promise<void>;
  onCancel?: () => void;
}

const DEFAULT_AGENT: Agent = {
  name: "",
  role: "proposer",
  soul: "",
  model: "qwen3:14b",
  provider: "ollama",
};

export function GroupForm({ initial, onSave, onCancel }: GroupFormProps) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [availableModels, setAvailableModels] = useState<string[]>(["qwen3:14b"]);

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then(setAvailableModels);
  }, []);
  const [agents, setAgents] = useState<Agent[]>(
    initial?.agents?.length ? initial.agents : [{ ...DEFAULT_AGENT, color: AGENT_COLORS[0] }]
  );
  const [phaseConfig, setPhaseConfig] = useState<PhaseConfig>(
    initial?.phase_config || { diverge: 2, challenge: 2, converge: 1 }
  );
  const [saving, setSaving] = useState(false);

  const addAgent = () => {
    setAgents([...agents, { ...DEFAULT_AGENT, color: AGENT_COLORS[agents.length % AGENT_COLORS.length] }]);
  };

  const removeAgent = (index: number) => {
    setAgents(agents.filter((_, i) => i !== index));
  };

  const updateAgent = (index: number, field: keyof Agent, value: string) => {
    const updated = [...agents];
    updated[index] = { ...updated[index], [field]: value };
    setAgents(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, description, agents, phase_config: phaseConfig });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Group Name</Label>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Red Team" />
        </div>
        <div>
          <Label>Description</Label>
          <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Stress-test ideas..." />
        </div>
      </div>

      <div>
        <Label>Phase Rounds</Label>
        <div className="mt-1 flex gap-4">
          {(["diverge", "challenge", "converge"] as const).map((phase) => (
            <div key={phase} className="flex items-center gap-2">
              <span className="text-xs capitalize text-neutral-400">{phase}</span>
              <Input
                type="number"
                min={1}
                max={10}
                className="w-16"
                value={phaseConfig[phase]}
                onChange={(e) => setPhaseConfig({ ...phaseConfig, [phase]: parseInt(e.target.value) || 1 })}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label>Agents ({agents.length})</Label>
          <Button variant="outline" size="sm" onClick={addAgent}>
            <Plus className="mr-1 h-3 w-3" /> Add Agent
          </Button>
        </div>

        <div className="space-y-3">
          {agents.map((agent, i) => (
            <Card key={i} className="border-neutral-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: agent.color || AGENT_COLORS[i % AGENT_COLORS.length] }} />
                    <CardTitle className="text-sm">{agent.name || `Agent ${i + 1}`}</CardTitle>
                  </div>
                  {agents.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAgent(i)}>
                      <Trash2 className="h-3 w-3 text-neutral-500" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input className="mt-1" value={agent.name} onChange={(e) => updateAgent(i, "name", e.target.value)} placeholder="Advocate" />
                  </div>
                  <div>
                    <Label className="text-xs">Role</Label>
                    <Select value={agent.role} onValueChange={(v) => updateAgent(i, "role", v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proposer">Proposer</SelectItem>
                        <SelectItem value="adversary">Adversary</SelectItem>
                        <SelectItem value="synthesizer">Synthesizer</SelectItem>
                        <SelectItem value="judge">Judge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Provider</Label>
                    <Select value="ollama" onValueChange={(v) => updateAgent(i, "provider", v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">Ollama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Model</Label>
                    <Select value={agent.model} onValueChange={(v) => updateAgent(i, "model", v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs">Soul (personality prompt)</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    value={agent.soul}
                    onChange={(e) => updateAgent(i, "soul", e.target.value)}
                    placeholder="You propose and defend ideas with conviction..."
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !name || agents.some((a) => !a.name)}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Saving..." : "Save Group"}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  );
}
