import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const reports = await prisma.report.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        reporter: { select: { id: true, displayName: true, email: true } },
        reported: { select: { id: true, displayName: true, email: true, isSuspended: true } },
        room: { select: { id: true, mediaSource: true } },
        reviewedBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
