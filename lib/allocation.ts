// lib/allocation.ts
import { prisma } from './prisma';

/**
 * Mandatory provider rules per service name.
 * These provider NAMES are always assigned first (if quota available).
 */
const MANDATORY_RULES: Record<string, string[]> = {
  'Service 1': ['Provider 1'],
  'Service 2': ['Provider 5'],
  'Service 3': ['Provider 1', 'Provider 4'],
};

/**
 * Optional pool per service name.
 * Round-robin selection fills remaining slots from here.
 */
const OPTIONAL_POOLS: Record<string, string[]> = {
  'Service 1': ['Provider 2', 'Provider 3', 'Provider 4'],
  'Service 2': ['Provider 6', 'Provider 7', 'Provider 8'],
  'Service 3': ['Provider 2', 'Provider 3', 'Provider 5', 'Provider 6', 'Provider 7', 'Provider 8'],
};

const SLOTS_PER_LEAD = 3;

/**
 * Assigns exactly 3 providers to a lead using:
 * 1. Mandatory providers (if quota available)
 * 2. Round-robin from optional pool for remaining slots
 *
 * This entire function runs inside a serializable transaction to handle concurrency.
 */
export async function assignProvidersToLead(
  leadId: number,
  serviceName: string
): Promise<number[]> {
  return await prisma.$transaction(
    async (tx) => {
      const mandatory = MANDATORY_RULES[serviceName] ?? [];
      const optionalPool = OPTIONAL_POOLS[serviceName] ?? [];

      // Fetch all providers with a lock-friendly read
      const allProviders = await tx.provider.findMany({
        orderBy: { id: 'asc' },
      });

      const providerMap = new Map(allProviders.map((p) => [p.name, p]));

      const assignedProviderIds: number[] = [];

      // --- Step 1: Assign mandatory providers ---
      for (const name of mandatory) {
        const provider = providerMap.get(name);
        if (!provider) continue;
        if (provider.leadsReceived >= provider.monthlyQuota) continue; // quota exhausted
        if (assignedProviderIds.includes(provider.id)) continue; // already assigned
        assignedProviderIds.push(provider.id);
      }

      // --- Step 2: Fill remaining slots via round-robin from optional pool ---
      const slotsNeeded = SLOTS_PER_LEAD - assignedProviderIds.length;

      if (slotsNeeded > 0 && optionalPool.length > 0) {
        // Get the service to find its id
        const service = await tx.service.findUnique({ where: { name: serviceName } });
        if (!service) throw new Error(`Service not found: ${serviceName}`);

        // Get or create allocation pointer for this service
        let pointerRecord = await tx.serviceAllocationPointer.findUnique({
          where: { serviceId: service.id },
        });
        if (!pointerRecord) {
          pointerRecord = await tx.serviceAllocationPointer.create({
            data: { serviceId: service.id, pointer: 0 },
          });
        }

        let pointer = pointerRecord.pointer;
        let slotsAssigned = 0;
        let attempts = 0;
        const maxAttempts = optionalPool.length * 2; // avoid infinite loop

        while (slotsAssigned < slotsNeeded && attempts < maxAttempts) {
          const candidateName = optionalPool[pointer % optionalPool.length];
          pointer = (pointer + 1) % optionalPool.length;
          attempts++;

          const candidate = providerMap.get(candidateName);
          if (!candidate) continue;
          if (candidate.leadsReceived >= candidate.monthlyQuota) continue; // quota full
          if (assignedProviderIds.includes(candidate.id)) continue; // already in list

          assignedProviderIds.push(candidate.id);
          slotsAssigned++;
        }

        // Persist updated pointer
        await tx.serviceAllocationPointer.update({
          where: { serviceId: service.id },
          data: { pointer },
        });
      }

      // --- Step 3: Create assignment records and increment quota counters ---
      for (const providerId of assignedProviderIds) {
        await tx.leadAssignment.create({
          data: { leadId, providerId },
        });

        await tx.provider.update({
          where: { id: providerId },
          data: { leadsReceived: { increment: 1 } },
        });
      }

      return assignedProviderIds;
    },
    {
      isolationLevel: 'Serializable', // prevents race conditions on quota + pointer
      timeout: 10000,
    }
  );
}
