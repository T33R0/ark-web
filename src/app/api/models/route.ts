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
    try {
      return NextResponse.json(JSON.parse(data.value));
    } catch { /* fall through */ }
  }

  return NextResponse.json(["qwen3:14b"]);
}
