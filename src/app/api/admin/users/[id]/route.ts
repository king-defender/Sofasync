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

// Soft-delete: scrubs PII and blocks login/room access, but keeps the row so
// their past messages, room history, and any reports involving them still
// make sense to everyone else who can see that history. A true hard-delete
// would either cascade-remove all of that too, or fail outright the moment
// any foreign key still points at them.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth || auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const userId = params.id;
    if (userId === auth.userId) {
      return NextResponse.json({ error: "You can't delete your own account from here." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (existing.deletedAt) {
      return NextResponse.json({ error: 'User is already deleted' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isSuspended: true, // belt-and-suspenders: also blocks room create/join directly
        isVerified: false,
        passwordHash: null, // blocks password login outright
        email: `deleted_${userId}@sofasync.invalid`, // frees the real address for reuse, stays unique
        phone: null,
        displayName: 'Deleted User',
        avatarUrl: null,
        age: null,
      },
    });

    // Any pending tokens for the old email are meaningless now
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.passwordResetToken.deleteMany({ where: { userId } });

    await prisma.adminActionLog.create({
      data: {
        adminId: auth.userId,
        action: 'user_deleted',
        targetType: 'User',
        targetId: userId,
        details: { originalEmail: existing.email },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
