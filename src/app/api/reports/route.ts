import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportedId, roomId, reason, details } = await req.json();

    if (!reportedId || !reason) {
      return NextResponse.json({ error: 'Reported user ID and reason required' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: auth.userId,
        reportedId,
        roomId: roomId || null,
        reason: reason || 'OTHER',
        details: details || null,
        status: 'OPEN',
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Report submission error:', error);
    return NextResponse.json({ error: 'Failed to file report' }, { status: 500 });
  }
}
