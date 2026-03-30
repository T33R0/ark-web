import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1").replace(/\/v1\/?$/, "");

  try {
    const res = await fetch(`${baseUrl}/api/tags`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const data = await res.json();
    const models: string[] = (data.models || [])
      .map((m: { name: string }) => m.name)
      .filter((n: string) => !n.startsWith("nomic-embed")); // exclude embedding models
    return NextResponse.json(models);
  } catch {
    return NextResponse.json(["qwen3:14b"], { status: 200 }); // fallback
  }
}
