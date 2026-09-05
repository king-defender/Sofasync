import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const badges = await prisma.badge.findMany();
    return NextResponse.json({ badges });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { name, description, iconUrl } = await req.json();
    const badge = await prisma.badge.create({
      data: { name, description, iconUrl },
    });

    await prisma.adminActionLog.create({
      data: {
        adminId: auth.userId,
        action: 'badge_created',
        targetType: 'Badge',
        targetId: badge.id,
        details: { name },
      },
    });

    return NextResponse.json({ badge });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create badge' }, { status: 500 });
  }
}
