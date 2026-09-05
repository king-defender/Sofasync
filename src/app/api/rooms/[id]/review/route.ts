import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roomId = params.id;
    const { rating, comment } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const review = await prisma.review.create({
      data: {
        roomId,
        authorId: auth.userId,
        rating: parseInt(rating),
        comment: comment || null,
      },
    });

    // Also record WatchHistory entry for user
    const participants = await prisma.roomParticipant.findMany({
      where: { roomId },
      select: { userId: true },
    });

    const watchedWith = participants.map((p) => p.userId).filter((id) => id !== auth.userId);

    await prisma.watchHistory.create({
      data: {
        userId: auth.userId,
        roomId,
        watchedWith,
      },
    });

    // Evaluate Movie marathon badge (10 sessions)
    const historyCount = await prisma.watchHistory.count({
      where: { userId: auth.userId },
    });

    if (historyCount >= 10) {
      const marathonBadge = await prisma.badge.findUnique({ where: { name: 'Movie marathon' } });
      if (marathonBadge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: auth.userId, badgeId: marathonBadge.id } },
          create: { userId: auth.userId, badgeId: marathonBadge.id },
          update: {},
        });
      }
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Submit review error:', error);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
