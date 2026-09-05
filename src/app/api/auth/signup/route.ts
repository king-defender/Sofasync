import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendMail, verificationEmail } from '@/lib/mailer';
import { getAppSettings } from '@/lib/settings';

// Strips everything but digits and a leading "+", then requires a plausible
// international length - not real phone validation (that needs a carrier
// lookup or a library), just enough to reject obvious garbage.
function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (hasPlus ? '+' : '') + digits;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, phone } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    // bcrypt silently truncates anything past 72 bytes - reject instead of
    // giving a false sense of a longer password actually being enforced.
    if (password.length > 72) {
      return NextResponse.json({ error: 'Password must be at most 72 characters' }, { status: 400 });
    }

    let normalizedPhone: string | null = null;
    if (phone && phone.trim()) {
      normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    if (normalizedPhone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
      if (existingPhone) {
        return NextResponse.json({ error: 'Phone number already registered' }, { status: 400 });
      }
    }

    const { requireEmailVerification } = await getAppSettings();

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        phone: normalizedPhone,
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
