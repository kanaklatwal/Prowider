// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sseBus } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, idempotencyKey } = body;

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'idempotencyKey is required' },
        { status: 400 }
      );
    }

    if (!event) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    // --- Idempotency Check ---
    // If this key was already processed, return early without side effects
    const existing = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          idempotent: true,
          message: `Event '${event}' already processed at ${existing.processedAt.toISOString()}`,
        },
        { status: 200 }
      );
    }

    // --- Process event ---
    if (event === 'payment.subscription.renewed') {
      // Reset all provider quotas inside a transaction
      await prisma.$transaction(async (tx) => {
        // Record the webhook event first (idempotency lock)
        await tx.webhookEvent.create({
          data: { idempotencyKey, eventType: event },
        });

        // Reset all providers
        await tx.provider.updateMany({
          data: {
            monthlyQuota: 10,
            leadsReceived: 0,
          },
        });

        // Reset all allocation pointers so round-robin starts fresh
        await tx.serviceAllocationPointer.updateMany({
          data: { pointer: 0 },
        });
      });

      // Notify dashboard
      sseBus.publish('quota-reset', { message: 'All provider quotas have been reset to 10' });

      return NextResponse.json({
        success: true,
        idempotent: false,
        message: 'Quota reset complete for all providers',
      });
    }

    return NextResponse.json({ error: `Unknown event type: ${event}` }, { status: 400 });
  } catch (error: unknown) {
    console.error('POST /api/webhook error:', error);

    // Unique constraint on idempotencyKey = concurrent duplicate webhook
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { success: true, idempotent: true, message: 'Concurrent duplicate webhook ignored' },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
