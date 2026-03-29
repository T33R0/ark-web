"use client";

import { useState } from "react";
import type { QuestionCreate, Group } from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";

interface QuestionFormProps {
  groups: Group[];
  initial?: Partial<QuestionCreate>;
  onSave: (question: QuestionCreate) => Promise<void>;
  onCancel?: () => void;
}

export function QuestionForm({ groups, initial, onSave, onCancel }: QuestionFormProps) {
  const [prompt, setPrompt] = useState(initial?.prompt || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty || "medium");
  const [recommendedGroupId, setRecommendedGroupId] = useState(initial?.recommended_group_id || "");
  const [recommendedRounds, setRecommendedRounds] = useState(initial?.recommended_rounds || 5);
  const [tagsStr, setTagsStr] = useState((initial?.tags || []).join(", "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        prompt,
        category: category || null,
        difficulty: (difficulty as QuestionCreate["difficulty"]) || null,
        recommended_group_id: (recommendedGroupId && recommendedGroupId !== "__none__") ? recommendedGroupId : null,
        recommended_rounds: recommendedRounds,
        tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Question / Prompt</Label>
        <Textarea
          className="mt-1"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What does it mean to be a persistent AI agent?"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Rounds</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={20}
            value={recommendedRounds}
            onChange={(e) => setRecommendedRounds(parseInt(e.target.value) || 5)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Recommended Group</Label>
          <Select value={recommendedGroupId} onValueChange={setRecommendedGroupId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Any group..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tags (comma-separated)</Label>
          <Input
            className="mt-1"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="ai, ethics, strategy"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !prompt}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Saving..." : "Save Question"}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  );
}
