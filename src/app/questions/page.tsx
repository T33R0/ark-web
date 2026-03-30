"use client";

import { useEffect, useState, useCallback } from "react";
import type { Question, Group } from "@/lib/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QuestionForm } from "@/components/questions/question-form";
import { Plus, Search, Archive, RotateCcw, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const DIFF_COLORS: Record<string, "outline" | "info" | "warning" | "destructive"> = {
  easy: "info",
  medium: "outline",
  hard: "warning",
  extreme: "destructive",
};

export default function QuestionsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const load = useCallback(() => {
    fetch("/api/questions").then((r) => r.json()).then(setQuestions);
    fetch("/api/groups").then((r) => r.json()).then(setGroups);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = questions.filter((q) => {
    if (!showArchived && q.archived) return false;
    if (showArchived && !q.archived) return false;
    if (filterCategory !== "all" && q.category !== filterCategory) return false;
    if (filterDifficulty !== "all" && q.difficulty !== filterDifficulty) return false;
    if (search && !q.prompt.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (data: Parameters<typeof fetch>[1] extends undefined ? never : unknown) => {
    const qData = data as { prompt: string; category: string | null; difficulty: string | null; recommended_group_id: string | null; recommended_rounds: number; tags: string[] };
    if (editingQuestion) {
      await fetch(`/api/questions/${editingQuestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qData),
      });
    } else {
      await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qData),
      });
    }
    setDialogOpen(false);
    setEditingQuestion(null);
    load();
  };

  const handleArchive = async (id: string, archived: boolean) => {
    await fetch(`/api/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    load();
  };

  const handleQuickLaunch = (question: Question) => {
    const groupId = question.recommended_group_id || groups[0]?.id;
    if (!groupId) return;
    router.push(`/sessions?launch=true&question=${question.id}&group=${groupId}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-sm text-neutral-400">{questions.filter(q => !q.archived).length} active questions</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingQuestion(null); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Question
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input className="pl-9" placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
          <Archive className="mr-1 h-3 w-3" /> {showArchived ? "Archived" : "Active"}
        </Button>
      </div>

      {/* Question List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              No questions found. {!showArchived && "Try checking the archive."}
            </CardContent>
          </Card>
        )}
        {filtered.map((q) => (
          <Card key={q.id} className="transition-colors hover:border-neutral-700">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{q.prompt}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {q.category && (
                      <Badge variant="secondary" className="text-[10px]">{q.category}</Badge>
                    )}
                    {q.difficulty && (
                      <Badge variant={DIFF_COLORS[q.difficulty] || "outline"} className="text-[10px]">{q.difficulty}</Badge>
                    )}
                    {q.tags?.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                    {q.times_run > 0 && (
                      <span className="text-[10px] text-neutral-500">Run {q.times_run}x</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Launch" onClick={() => handleQuickLaunch(q)}>
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title={q.archived ? "Restore" : "Archive"} onClick={() => handleArchive(q.id, !q.archived)}>
                      {q.archived ? <RotateCcw className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>
              {editingQuestion ? "Update the question details." : "Add a new question to the bank."}
            </DialogDescription>
          </DialogHeader>
          <QuestionForm
            groups={groups}
            initial={editingQuestion || undefined}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
