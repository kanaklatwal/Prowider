// app/api/sse/route.ts
import { NextResponse } from 'next/server';
import { sseBus } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial ping to establish connection
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      // Subscribe to SSE bus
      const unsubscribe = sseBus.subscribe((payload) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected
          unsubscribe();
        }
      });

      // Heartbeat every 25 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 25000);

      // Cleanup on close
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
