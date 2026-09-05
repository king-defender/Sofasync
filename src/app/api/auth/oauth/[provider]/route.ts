import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { signAccessToken } from '@/lib/auth';
import { getProviderConfig, buildAuthorizeUrl, completeOAuth } from '@/lib/oauth';

const STATE_COOKIE = 'oauth_state';

// Single route handles both legs of the flow:
//  - no `code` query param  -> redirect the browser to the provider's consent screen
//  - `code` present         -> exchange it for a token, fetch the profile, log the user in
// This keeps one callback URL per provider to register in each developer console.
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider.toLowerCase();
  const config = getProviderConfig(provider);

  if (!config) {
    return NextResponse.json({ error: 'Invalid OAuth provider' }, { status: 400 });
  }

  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(new URL(`/login?error=oauth_not_configured&provider=${provider}`, req.url));
  }

  const redirectUri = new URL(`/api/auth/oauth/${provider}`, process.env.NEXTAUTH_URL || req.url).toString();
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    // Leg 1: send the user to the provider, remembering a CSRF state value.
    const state = crypto.randomBytes(16).toString('hex');
    const authorizeUrl = buildAuthorizeUrl(provider as 'google' | 'github' | 'discord', redirectUri, state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(STATE_COOKIE, `${provider}:${state}`, {
      httpOnly: true,
      path: '/',
      maxAge: 300,
      sameSite: 'lax',
    });
    return response;
  }

  // Leg 2: provider redirected back with a code - verify state, then exchange it.
  const returnedState = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!savedState || savedState !== `${provider}:${returnedState}`) {
    return NextResponse.redirect(new URL('/login?error=oauth_state_mismatch', req.url));
  }

  try {
    const profile = await completeOAuth(provider as 'google' | 'github' | 'discord', code, redirectUri);

    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          isVerified: true, // the provider already verified this email
          isGuest: false,
        },
      });
    }

    if (user.isSuspended) {
      return NextResponse.redirect(new URL('/login?error=account_suspended', req.url));
    }

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    });

    const response = NextResponse.redirect(new URL('/dashboard', req.url));
    response.cookies.set('token', token, { httpOnly: true, path: '/' });
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error(`OAuth (${provider}) error:`, error);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url));
  }
}
