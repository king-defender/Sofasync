'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tv, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing verification token.');
      return;
    }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setError(data.error || 'Verification failed.');
        } else {
          setStatus('success');
        }
      })
      .catch(() => {
        setStatus('error');
        setError('An error occurred. Please try again.');
      });
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-border shadow-2xl space-y-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center mx-auto">
          <Tv className="w-6 h-6 text-foreground" />
        </div>

        {status === 'verifying' && (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Email verified</h2>
            <p className="text-xs text-muted-foreground">Your account is ready. You can log in now.</p>
            <Link
              href="/login"
              className="inline-block w-full py-3 bg-primary hover:bg-primary-hover text-foreground text-xs font-bold rounded-xl glow-button transition-all"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Verification failed</h2>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Link href="/login" className="text-primary text-xs font-semibold hover:underline">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
