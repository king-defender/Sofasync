export type OAuthProviderName = 'google' | 'github' | 'discord';

export interface OAuthProfile {
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  // Exchanges an authorization code for an access token.
  exchangeCode(code: string, redirectUri: string, clientId: string, clientSecret: string): Promise<string>;
  // Uses the access token to fetch a normalized profile.
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

async function exchangeJsonToken(
  tokenUrl: string,
  params: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...extraHeaders,
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`No access_token in provider response: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

const PROVIDERS: Record<OAuthProviderName, ProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    async exchangeCode(code, redirectUri, clientId, clientSecret) {
      return exchangeJsonToken(this.tokenUrl, {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
    },
    async fetchProfile(accessToken) {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      return {
        providerId: json.sub,
        email: json.email,
        displayName: json.name || json.email,
        avatarUrl: json.picture || null,
      };
    },
  },

  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    async exchangeCode(code, redirectUri, clientId, clientSecret) {
      return exchangeJsonToken(this.tokenUrl, {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });
    },
    async fetchProfile(accessToken) {
      const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };
      const [userRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', { headers }),
        fetch('https://api.github.com/user/emails', { headers }),
      ]);
      const user = await userRes.json();

      // GitHub only returns email on /user if it's public - fall back to the
      // primary verified address from /user/emails otherwise.
      let email = user.email as string | null;
      if (!email && emailsRes.ok) {
        const emails: Array<{ email: string; primary: boolean; verified: boolean }> = await emailsRes.json();
        email = emails.find((e) => e.primary && e.verified)?.email || emails.find((e) => e.verified)?.email || null;
      }

      if (!email) {
        throw new Error('GitHub account has no accessible verified email');
      }

      return {
        providerId: String(user.id),
        email,
        displayName: user.name || user.login,
        avatarUrl: user.avatar_url || null,
      };
    },
  },

  discord: {
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    async exchangeCode(code, redirectUri, clientId, clientSecret) {
      return exchangeJsonToken(this.tokenUrl, {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
    },
    async fetchProfile(accessToken) {
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!json.email) {
        throw new Error('Discord account has no accessible email (grant the "email" scope)');
      }
      return {
        providerId: json.id,
        email: json.email,
        displayName: json.username,
        avatarUrl: json.avatar ? `https://cdn.discordapp.com/avatars/${json.id}/${json.avatar}.png` : null,
      };
    },
  },
};

export function getProviderConfig(provider: string): ProviderConfig | null {
  if (provider !== 'google' && provider !== 'github' && provider !== 'discord') return null;
  return PROVIDERS[provider];
}

export function buildAuthorizeUrl(provider: OAuthProviderName, redirectUri: string, state: string): string {
  const config = PROVIDERS[provider];
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId!);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function completeOAuth(
  provider: OAuthProviderName,
  code: string,
  redirectUri: string
): Promise<OAuthProfile> {
  const config = PROVIDERS[provider];
  const accessToken = await config.exchangeCode(code, redirectUri, config.clientId!, config.clientSecret!);
  return config.fetchProfile(accessToken);
}
