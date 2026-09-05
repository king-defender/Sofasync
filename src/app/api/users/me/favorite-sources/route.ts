import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const favorites = await prisma.favoriteSource.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { youtubeId, title } = await req.json().catch(() => ({}));
  if (!youtubeId) return NextResponse.json({ error: 'youtubeId required' }, { status: 400 });

  const favorite = await prisma.favoriteSource.upsert({
    where: { userId_youtubeId: { userId: auth.userId, youtubeId } },
    update: { title: title || null },
    create: { userId: auth.userId, youtubeId, title: title || null },
  });
  return NextResponse.json({ favorite });
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { youtubeId } = await req.json().catch(() => ({}));
  if (!youtubeId) return NextResponse.json({ error: 'youtubeId required' }, { status: 400 });

  await prisma.favoriteSource.deleteMany({ where: { userId: auth.userId, youtubeId } });
  return NextResponse.json({ success: true });
}
