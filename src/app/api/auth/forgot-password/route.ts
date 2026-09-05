import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { sendMail, passwordResetEmail } from '@/lib/mailer';
import { isRateLimited, recordFailure } from '@/lib/rate-limit';

const GENERIC_MESSAGE = { message: 'If email exists, password reset link has been sent.' };
const RESET_REQUEST_LIMIT = 3;
const RESET_WINDOW_SECONDS = 60 * 60;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Same generic response whether the email doesn't exist or is
    // rate-limited - either would otherwise leak whether the account exists.
    const rateLimitKey = `ratelimit:forgot-password:${email.toLowerCase()}`;
    if (await isRateLimited(rateLimitKey, RESET_REQUEST_LIMIT)) {
      return NextResponse.json(GENERIC_MESSAGE);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(GENERIC_MESSAGE);
    }

    await recordFailure(rateLimitKey, RESET_WINDOW_SECONDS);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetToken,
        expiresAt,
      },
    });

    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
    await sendMail({ to: user.email, ...passwordResetEmail(link) });

    // Same generic message as the "no such user" branch above - a different
    // string here would itself let an attacker enumerate which emails exist.
    return NextResponse.json(GENERIC_MESSAGE);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
