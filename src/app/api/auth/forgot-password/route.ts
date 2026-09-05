import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { sendMail, passwordResetEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success to avoid user enumeration
      return NextResponse.json({ message: 'If email exists, password reset link has been sent.' });
    }

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

    return NextResponse.json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
