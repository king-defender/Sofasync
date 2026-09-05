import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SofaSync database...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  const userPasswordHash = await bcrypt.hash('user123', 10);

  // 1. Seed Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sofasync.com' },
    update: {},
    create: {
      email: 'admin@sofasync.com',
      passwordHash,
      displayName: 'Super Admin',
      isVerified: true,
      role: Role.SUPER_ADMIN,
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
    },
  });

  // 2. Seed Sample Users
  const deepak = await prisma.user.upsert({
    where: { email: 'deepak@sofasync.com' },
    update: {},
    create: {
      email: 'deepak@sofasync.com',
      passwordHash: userPasswordHash,
      displayName: 'Deepak Kumar',
      isVerified: true,
      role: Role.USER,
      age: 26,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Deepak',
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@sofasync.com' },
    update: {},
    create: {
      email: 'sarah@sofasync.com',
      passwordHash: userPasswordHash,
      displayName: 'Sarah Connor',
      isVerified: true,
      role: Role.USER,
      age: 24,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    },
  });

  const alex = await prisma.user.upsert({
    where: { email: 'alex@sofasync.com' },
    update: {},
    create: {
      email: 'alex@sofasync.com',
      passwordHash: userPasswordHash,
      displayName: 'Alex Rivers',
      isVerified: true,
      role: Role.USER,
      age: 28,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    },
  });

  // 3. Seed Contacts
  await prisma.contact.upsert({
    where: {
      initiatorId_receiverId: {
        initiatorId: deepak.id,
        receiverId: sarah.id,
      },
    },
    update: { status: 'ACCEPTED' },
    create: {
      initiatorId: deepak.id,
      receiverId: sarah.id,
      status: 'ACCEPTED',
    },
  });

  await prisma.contact.upsert({
    where: {
      initiatorId_receiverId: {
        initiatorId: deepak.id,
        receiverId: alex.id,
      },
    },
    update: { status: 'ACCEPTED' },
    create: {
      initiatorId: deepak.id,
      receiverId: alex.id,
      status: 'ACCEPTED',
    },
  });

  // 4. Seed Initial 6 Badges
  const badges = [
    { name: 'First watch', description: 'Completed first room session', iconUrl: '🎬' },
    { name: 'Movie marathon', description: '10 completed watch sessions', iconUrl: '🍿' },
    { name: 'Social butterfly', description: '5 different watch buddies', iconUrl: '🦋' },
    { name: 'Breaking the ice', description: 'First successful stranger match', iconUrl: '🧊' },
    { name: 'Chatterbox', description: '100 chat messages sent', iconUrl: '💬' },
    { name: 'Regular', description: '3 sessions with the same buddy in one week', iconUrl: '⭐' },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: { description: badge.description, iconUrl: badge.iconUrl },
      create: badge,
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
