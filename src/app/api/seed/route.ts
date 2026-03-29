import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SEED_GROUPS, SEED_QUESTIONS } from "@/lib/seed-data";

export async function POST() {
  const db = createServerClient();

  // Check if already seeded
  const { data: existingGroups } = await db.from("ark_groups").select("id").limit(1);
  if (existingGroups && existingGroups.length > 0) {
    return NextResponse.json({ message: "Already seeded", skipped: true });
  }

  // Insert groups
  const groupMap = new Map<string, string>();

  for (const group of SEED_GROUPS) {
    const { data, error } = await db
      .from("ark_groups")
      .insert(group)
      .select("id, name")
      .single();

    if (error) {
      return NextResponse.json({ error: `Failed to insert group ${group.name}: ${error.message}` }, { status: 500 });
    }
    if (data) {
      groupMap.set(data.name, data.id);
    }
  }

  // Insert questions with resolved group references
  for (const { _group_name, ...question } of SEED_QUESTIONS) {
    const groupId = groupMap.get(_group_name) || null;

    const { error } = await db
      .from("ark_questions")
      .insert({ ...question, recommended_group_id: groupId });

    if (error) {
      console.error(`Failed to insert question: ${error.message}`);
    }
  }

  return NextResponse.json({
    message: "Seeded successfully",
    groups: SEED_GROUPS.length,
    questions: SEED_QUESTIONS.length,
  });
}
