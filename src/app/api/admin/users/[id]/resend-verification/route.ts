import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { sendMail, verificationEmail } from '@/lib/mailer';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const userId = params.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.isVerified) return NextResponse.json({ error: 'User is already verified' }, { status: 400 });

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.upsert({
    where: { userId },
    update: { tokenHash: token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    create: { userId, tokenHash: token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const link = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  await sendMail({ to: user.email, ...verificationEmail(link) });

  await prisma.adminActionLog.create({
    data: {
      adminId: auth.userId,
      action: 'verification_email_resent',
      targetType: 'User',
      targetId: userId,
      details: { targetEmail: user.email },
    },
  });

  return NextResponse.json({ message: 'Verification email re-sent (or logged to server console if SMTP is not configured).' });
}
