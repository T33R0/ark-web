import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("conn_state")
    .select("key, value")
    .in("key", ["ark_ollama_models", "ark_mlx_models"]);

  const result: Record<string, string[]> = { ollama: ["qwen3:14b"], mlx: [] };

  for (const row of data || []) {
    const models = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    if (!Array.isArray(models) || models.length === 0) continue;

    if (row.key === "ark_ollama_models") result.ollama = models;
    if (row.key === "ark_mlx_models") result.mlx = models;
  }

  return NextResponse.json(result);
}
