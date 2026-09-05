import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const userId = params.id;
    const { isSuspended } = await req.json();

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: Boolean(isSuspended) },
    });

    // Write AdminActionLog (FR-8.8)
    await prisma.adminActionLog.create({
      data: {
        adminId: auth.userId,
        action: isSuspended ? 'user_suspended' : 'user_unsuspended',
        targetType: 'User',
        targetId: userId,
        details: { targetEmail: user.email },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to suspend/unsuspend user' }, { status: 500 });
  }
}
