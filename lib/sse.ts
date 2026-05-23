// lib/sse.ts
// Simple in-process pub/sub for Server-Sent Events.
// In production with multiple instances, replace with Redis pub/sub.

type Subscriber = (data: string) => void;

class SSEBus {
  private subscribers: Set<Subscriber> = new Set();

  subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  publish(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.subscribers.forEach((fn) => fn(payload));
  }
}

// Singleton
const globalForSSE = globalThis as unknown as { sseBus: SSEBus | undefined };
export const sseBus = globalForSSE.sseBus ?? new SSEBus();
if (process.env.NODE_ENV !== 'production') globalForSSE.sseBus = sseBus;
