import { NextRequest } from 'next/server';
import { addSSEListener, removeSSEListener, getSessionById } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

// GET /api/sessions/[sessionId]/events — SSE event stream
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { sessionId } = await context.params;

  // Verify session exists
  const session = getSessionById(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: '세션을 찾을 수 없습니다.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectMsg = JSON.stringify({
        type: 'connected',
        data: { sessionId, members: session.members },
        timestamp: new Date().toISOString(),
        sender: 'system',
      });
      controller.enqueue(encoder.encode(`data: ${connectMsg}\n\n`));

      // Register this controller as a listener
      addSSEListener(sessionId, controller);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on abort (client disconnects)
      _request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        removeSSEListener(sessionId, controller);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      // Stream cancelled
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
