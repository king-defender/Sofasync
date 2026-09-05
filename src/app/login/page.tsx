'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tv, Lock, Mail, ArrowRight, Github, Chrome, Disc as Discord } from 'lucide-react';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: 'That sign-in provider is not configured yet. Contact the site admin.',
  oauth_disabled: 'That sign-in method is currently disabled by the site admin.',
  oauth_state_mismatch: 'That sign-in link expired or was already used. Please try again.',
  oauth_failed: 'Sign-in with that provider failed. Please try again.',
  account_suspended: 'This account has been suspended.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false, discord: false });

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(OAUTH_ERROR_MESSAGES[oauthError] || 'Sign-in failed. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/auth/oauth-providers')
      .then((res) => res.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  const anyProviderAvailable = providers.google || providers.github || providers.discord;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-6 relative">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-border shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center mb-3">
            <Tv className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
          <p className="text-xs text-muted-foreground mt-1">Sign in to your SofaSync account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* Social Login Buttons - only shown for providers actually configured */}
        {anyProviderAvailable && (
          <div className="space-y-2.5">
            {providers.google && (
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                className="w-full py-2.5 px-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-semibold text-foreground flex items-center justify-center gap-3 transition-colors"
              >
                <Chrome className="w-4 h-4 text-red-600 dark:text-red-400" />
                Continue with Google
              </button>
            )}

            {providers.github && (
              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                className="w-full py-2.5 px-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-semibold text-foreground flex items-center justify-center gap-3 transition-colors"
              >
                <Github className="w-4 h-4 text-foreground" />
                Continue with GitHub
              </button>
            )}

            {providers.discord && (
              <button
                type="button"
                onClick={() => handleSocialLogin('discord')}
                className="w-full py-2.5 px-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-semibold text-foreground flex items-center justify-center gap-3 transition-colors"
              >
                <Discord className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Continue with Discord
              </button>
            )}
          </div>
        )}

        {anyProviderAvailable && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase font-semibold">
            <div className="flex-1 h-px bg-foreground/10"></div>
            <span>Or with email</span>
            <div className="flex-1 h-px bg-foreground/10"></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Email or Phone Number</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com or +1 555 123 4567"
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="text-right -mt-2">
            <Link href="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary-hover text-foreground text-xs font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Don't have an account?{' '}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
