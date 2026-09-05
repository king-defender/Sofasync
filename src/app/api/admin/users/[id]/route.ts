import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const userId = params.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        reportsFiled: true,
        reportsAgainst: true,
        reviews: true,
        watchHistory: true,
        badges: { include: { badge: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const userId = params.id;
    const { isVerified } = await req.json();

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isVerified: Boolean(isVerified) },
    });

    // Manual verification clears any pending token - it's no longer meaningful
    if (isVerified) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    }

    await prisma.adminActionLog.create({
      data: {
        adminId: auth.userId,
        action: isVerified ? 'user_manually_verified' : 'user_verification_revoked',
        targetType: 'User',
        targetId: userId,
        details: { targetEmail: user.email },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
