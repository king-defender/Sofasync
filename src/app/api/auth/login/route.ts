import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword, signAccessToken, AUTH_COOKIE_OPTIONS } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';
import { isRateLimited, recordFailure, resetRateLimit } from '@/lib/rate-limit';

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Keyed by email, not IP - this app sits behind Render's proxy without
    // guaranteed client-IP forwarding configured, and email-keyed still
    // stops the thing that actually matters here: guessing one account's
    // password over and over.
    const rateLimitKey = `ratelimit:login:${email.toLowerCase()}`;
    if (await isRateLimited(rateLimitKey, LOGIN_ATTEMPT_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Try again in 15 minutes.' },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      await recordFailure(rateLimitKey, LOGIN_WINDOW_SECONDS);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check account suspension (FR-8.4)
    if (user.isSuspended) {
      return NextResponse.json({ error: 'Account suspended. Contact support or administrator.' }, { status: 403 });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      await recordFailure(rateLimitKey, LOGIN_WINDOW_SECONDS);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await resetRateLimit(rateLimitKey);

    // FR-1.3: only a verified email can log in (checked after credentials match,
    // so a bad password never leaks verification status) - unless an admin has
    // switched the requirement off, in which case this also unblocks anyone who
    // signed up while it was on but never got/clicked the email.
    if (!user.isVerified) {
      const { requireEmailVerification } = await getAppSettings();
      if (requireEmailVerification) {
        return NextResponse.json(
          { error: 'Please verify your email before logging in. Check your inbox for the verification link.' },
          { status: 403 }
        );
      }
    }

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
        role: user.role,
      },
      token,
    });

    response.cookies.set('token', token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
