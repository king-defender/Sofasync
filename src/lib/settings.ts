import { prisma } from '@/lib/db';

// Self-healing singleton: always returns a row, creating the defaults on
// first read rather than requiring a separate seed/migration step.
export async function getAppSettings() {
  return prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}
