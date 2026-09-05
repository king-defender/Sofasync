import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied: Super Admin required' }, { status: 403 });
    }

    const [activeRoomsCount, queueCount, openReportsCount, totalUsersCount] = await Promise.all([
      prisma.room.count({ where: { status: 'ACTIVE' } }),
      prisma.matchmakingQueue.count({ where: { status: 'WAITING' } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.user.count(),
    ]);

    const recentLogs = await prisma.adminActionLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: { select: { displayName: true, email: true } },
      },
    });

    return NextResponse.json({
      activeRooms: activeRoomsCount,
      queuedUsers: queueCount,
      openReports: openReportsCount,
      totalUsers: totalUsersCount,
      recentLogs,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}
