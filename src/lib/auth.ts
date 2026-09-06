import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// Fail loudly rather than silently signing/verifying every session with a
// secret that's sitting in this file's git history on a public repo. The
// fallback only exists so `npm run dev` works with zero setup locally -
// production must always set its own.
//
// Skip during `next build` (NEXT_PHASE=phase-production-build): Next sets
// NODE_ENV=production while collecting page data for every API route, which
// runs this module at build time with no real env vars available yet -
// without this exception the production build can never succeed at all,
// even on Render where JWT_SECRET is genuinely set before the app starts.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PHASE !== 'phase-production-build' &&
  !process.env.JWT_SECRET
) {
  throw new Error('JWT_SECRET must be set in production - refusing to start with the public fallback secret.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'sofasync_jwt_secret_key_production_ready_hash_2026';

// Shared so every place that sets/clears the auth cookie agrees on its
// attributes - mismatched attributes between set and clear can leave a
// cookie the browser won't actually let a later call delete.
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'USER' | 'SUPER_ADMIN';
  displayName: string;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // 1 day for seamless dev UX
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function getAuthUser(req: NextRequest): TokenPayload | null {
  const authHeader = req.headers.get('authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check cookies
    const cookieToken = req.cookies.get('token')?.value;
    if (cookieToken) {
      token = cookieToken;
    }
  }

  if (!token) return null;
  return verifyToken(token);
}
