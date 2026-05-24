// app/api/leads/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assignProvidersToLead } from '@/lib/allocation';
import { sseBus } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, city, serviceId, description } = body;

    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: 'Phone must be a 10-digit number' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({ where: { id: Number(serviceId) } });
    if (!service) {
      return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
    }

    // Check duplicate: same phone + same service
    const existing = await prisma.lead.findUnique({
      where: { phone_serviceId: { phone, serviceId: Number(serviceId) } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `This phone number already has a lead for ${service.name}` },
        { status: 409 }
      );
    }

    // Create the lead
    const lead = await prisma.lead.create({
      data: { name, phone, city, serviceId: Number(serviceId), description },
    });

    // Assign providers (concurrency-safe via serializable transaction)
    const assignedProviderIds = await assignProvidersToLead(lead.id, service.name);

    // Fetch full lead data for SSE broadcast
    const fullLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        service: true,
        assignments: {
          include: { provider: true },
        },
      },
    });

    // Broadcast SSE to all dashboard subscribers
    sseBus.publish('new-lead', {
      lead: fullLead,
      assignedProviderIds,
    });

    return NextResponse.json({ success: true, lead: fullLead }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/leads error:', error);

    // Handle unique constraint violation (race condition fallback)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Duplicate lead detected (concurrent request)' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        service: true,
        assignments: {
          include: { provider: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(leads);
  } catch (error) {
    console.error('GET /api/leads error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
