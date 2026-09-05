import { NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/settings';

// Without this, Next statically caches the response at build time (no
// `request` param or dynamic API used here) - admin toggles and any OAuth
// credentials added later would never take effect without a full redeploy.
export const dynamic = 'force-dynamic';

// Public (no auth) - just booleans, never leaks the actual credentials.
// Lets the login/signup pages show only the social buttons that will
// actually work, instead of every button failing with "not configured"
// the moment someone clicks it.
export async function GET() {
  const settings = await getAppSettings();

  return NextResponse.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) && settings.oauthGoogleEnabled,
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) && settings.oauthGithubEnabled,
    discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) && settings.oauthDiscordEnabled,
  });
}
