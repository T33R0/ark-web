import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const { name, email, reason, use_case } = await req.json();

  if (!name?.trim() || !email?.trim() || !reason?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServerClient();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedReason = reason.trim();
  const trimmedUseCase = (use_case || "").trim();

  const description = [
    `Name: ${trimmedName}`,
    `Email: ${trimmedEmail}`,
    `Reason: ${trimmedReason}`,
    trimmedUseCase ? `Use case: ${trimmedUseCase}` : null,
  ].filter(Boolean).join("\n");

  const { error } = await supabase.from("conn_task_queue").insert({
    task: `ark_access_request: ${trimmedName} (${trimmedEmail})`,
    description,
    category: "ark",
    priority: 3,
    status: "pending",
  });

  if (error) {
    console.error("Failed to queue access request:", error);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
