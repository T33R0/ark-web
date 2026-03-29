import { NextRequest } from "next/server";
import { runSession } from "@/lib/orchestrator";

export const maxDuration = 300; // 5 minutes max for long sessions

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Run the session - this is intentionally not awaited for fire-and-forget behavior
  // But since we need the route to stay alive while the orchestrator runs,
  // we use a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: {"status":"started","session_id":"${id}"}\n\n`));
        await runSession(id);
        controller.enqueue(encoder.encode(`data: {"status":"completed","session_id":"${id}"}\n\n`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: {"status":"error","message":"${message.replace(/"/g, '\\"')}"}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
