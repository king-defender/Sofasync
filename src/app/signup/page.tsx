'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tv, Lock, Mail, User, ArrowRight, Github, Chrome, Disc as Discord, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [providers, setProviders] = useState({ google: false, github: false, discord: false });

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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        // Account is unverified until the emailed link is clicked (FR-1.2) - no
        // session yet - unless an admin has switched that requirement off.
        setVerificationRequired(data.verificationRequired ?? true);
        setCreated(true);
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
          <h2 className="text-2xl font-bold text-foreground">Create Account</h2>
          <p className="text-xs text-muted-foreground mt-1">Start watching together with your friends</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {created ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {verificationRequired ? (
                <>Account created! Check <span className="font-semibold text-foreground">{email}</span> for a verification link before logging in.</>
              ) : (
                <>Account created! You can log in now.</>
              )}
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 bg-primary hover:bg-primary-hover text-foreground text-xs font-bold rounded-xl glow-button transition-all"
            >
              Go to Login
            </Link>
          </div>
        ) : (
        <>
        {/* Social Options - only shown for providers actually configured */}
        {anyProviderAvailable && (
          <div className="space-y-2.5">
            {providers.google && (
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                className="w-full py-2.5 px-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-semibold text-foreground flex items-center justify-center gap-3 transition-colors"
              >
                <Chrome className="w-4 h-4 text-red-600 dark:text-red-400" />
                Sign up with Google
              </button>
            )}

            {providers.github && (
              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                className="w-full py-2.5 px-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-semibold text-foreground flex items-center justify-center gap-3 transition-colors"
              >
                <Github className="w-4 h-4 text-foreground" />
                Sign up with GitHub
              </button>
            )}

            {providers.discord && (
              <button
                type="button"
                onClick={() => handleSocialLogin('discord')}
                className="w-full py-2.5 px-4 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl text-xs font-semibold text-foreground flex items-center justify-center gap-3 transition-colors"
              >
                <Discord className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Sign up with Discord
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
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Display Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Deepak Kumar"
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary-hover text-foreground text-xs font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Creating Account...' : 'Get Started'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        </>
        )}

        {!created && (
          <p className="text-xs text-muted-foreground text-center">
            Already registered?{' '}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
