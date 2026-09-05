import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { displayName } = await req.json().catch(() => ({}));
    const guestName = displayName || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    const guestEmail = `guest_${Date.now()}@sofasync.local`;

    const user = await prisma.user.create({
      data: {
        email: guestEmail,
        displayName: guestName,
        isGuest: true,
        isVerified: true,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestName}`,
      },
    });

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isGuest: true,
        role: user.role,
      },
      token,
    });

    response.cookies.set('token', token, { httpOnly: true, path: '/' });
    return response;
  } catch (error) {
    console.error('Guest creation error:', error);
    return NextResponse.json({ error: 'Failed to create guest session' }, { status: 500 });
  }
}
