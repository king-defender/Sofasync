import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendMail, verificationEmail } from '@/lib/mailer';
import { getAppSettings } from '@/lib/settings';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const { requireEmailVerification } = await getAppSettings();

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        isVerified: !requireEmailVerification, // FR-1.2, unless an admin has turned the requirement off
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`,
      },
    });

    if (requireEmailVerification) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });

      const link = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
      await sendMail({ to: user.email, ...verificationEmail(link) });
    }

    // No session cookie yet either way - the frontend routes to /login next,
    // which is the one place session issuance is decided.
    return NextResponse.json({
      message: requireEmailVerification
        ? 'Account created. Check your email to verify your account before logging in.'
        : 'Account created. You can log in now.',
      verificationRequired: requireEmailVerification,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
