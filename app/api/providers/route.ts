// app/api/providers/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        leadAssignments: {
          include: {
            lead: {
              include: { service: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error('GET /api/providers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
