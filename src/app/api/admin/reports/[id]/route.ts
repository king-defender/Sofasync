import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const reportId = params.id;
    const { status, resolutionNote } = await req.json();

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: status || 'REVIEWED',
        resolutionNote: resolutionNote || null,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });

    // Write AdminActionLog entry (FR-8.8)
    await prisma.adminActionLog.create({
      data: {
        adminId: auth.userId,
        action: `report_${status?.toLowerCase() || 'reviewed'}`,
        targetType: 'Report',
        targetId: reportId,
        details: { resolutionNote, status },
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}
