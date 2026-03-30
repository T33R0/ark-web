import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("conn_state")
    .select("value")
    .eq("key", "ark_ollama_models")
    .single();

  if (data?.value) {
    const models = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    if (Array.isArray(models) && models.length > 0) {
      return NextResponse.json(models);
    }
  }

  return NextResponse.json(["qwen3:14b"]);
}
