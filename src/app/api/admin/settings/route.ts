import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

const TOGGLE_KEYS = [
  'requireEmailVerification',
  'guestAccessEnabled',
  'matchmakingEnabled',
  'publicLobbyEnabled',
  'oauthGoogleEnabled',
  'oauthGithubEnabled',
  'oauthDiscordEnabled',
] as const;

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, boolean> = {};
  for (const key of TOGGLE_KEYS) {
    if (typeof body[key] === 'boolean') data[key] = body[key];
  }

  const settings = await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });

  await prisma.adminActionLog.create({
    data: {
      adminId: auth.userId,
      action: 'settings_updated',
      targetType: 'AppSetting',
      targetId: 'singleton',
      details: data,
    },
  });

  return NextResponse.json({ settings });
}
