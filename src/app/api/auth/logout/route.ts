import { NextResponse } from 'next/server';
import { AUTH_COOKIE_OPTIONS } from '@/lib/auth';

// httpOnly cookies are invisible to client JS by design - only a server
// response can actually clear one. This is why logout needs a real endpoint
// rather than the client trying to blank document.cookie itself. Options
// must match how the cookie was set, or some browsers won't actually clear it.
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('token', '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
