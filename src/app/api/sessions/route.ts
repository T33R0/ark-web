import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db
    .from("ark_sessions")
    .select("*")
    .neq("source", "war-room")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const db = createServerClient();
  const body = await req.json();
  const { topic, group_id, question_id, max_rounds } = body;

  // Load group for snapshot
  const { data: group } = await db
    .from("ark_groups")
    .select("*")
    .eq("id", group_id)
    .single();

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const phaseConfig = group.phase_config || { diverge: 2, challenge: 2, converge: 1 };
  const totalPhaseRounds = phaseConfig.diverge + phaseConfig.challenge + phaseConfig.converge;
  const effectiveMaxRounds = max_rounds || totalPhaseRounds;

  const { data, error } = await db
    .from("ark_sessions")
    .insert({
      topic,
      group_id,
      question_id: question_id || null,
      max_rounds: effectiveMaxRounds,
      phase_config: phaseConfig,
      group_snapshot: { name: group.name, agents: group.agents },
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
