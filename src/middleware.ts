import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Every protected page currently only checks auth client-side (fetch
// /api/auth/me in a useEffect, redirect on failure) - meaning the page
// briefly loads before bouncing an unauthenticated visitor, and there's no
// server-side gate at all if that client check is ever skipped or broken.
// This runs before any of that, at the routing layer, using the same
// httpOnly "token" cookie the API routes already trust.
//
// jose (not jsonwebtoken) because middleware runs on the Edge runtime by
// default, which has no Node crypto - jose is built on Web Crypto instead.
// Can't import the same check from src/lib/auth.ts here: that file also
// pulls in bcryptjs/jsonwebtoken, which aren't Edge-compatible.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production - refusing to start with the public fallback secret.');
}
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sofasync_jwt_secret_key_production_ready_hash_2026'
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (pathname.startsWith('/admin') && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  } catch {
    // Expired or tampered token - send to login and drop the bad cookie
    // rather than leaving it to fail again on every subsequent request.
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.set('token', '', {
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    });
    return response;
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/matchmaking/:path*', '/lobby/:path*', '/room/:path*', '/admin/:path*'],
};
