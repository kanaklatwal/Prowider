// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Services
  const services = ['Service 1', 'Service 2', 'Service 3'];
  for (const name of services) {
    await prisma.service.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('✓ Services seeded');

  // Providers
  for (let i = 1; i <= 8; i++) {
    await prisma.provider.upsert({
      where: { name: `Provider ${i}` },
      update: {},
      create: {
        name: `Provider ${i}`,
        monthlyQuota: 10,
        leadsReceived: 0,
      },
    });
  }
  console.log('✓ Providers seeded');

  // Initialize service allocation pointers for each service
  const allServices = await prisma.service.findMany();
  for (const service of allServices) {
    await prisma.serviceAllocationPointer.upsert({
      where: { serviceId: service.id },
      update: {},
      create: { serviceId: service.id, pointer: 0 },
    });
  }
  console.log('✓ Allocation pointers initialized');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
