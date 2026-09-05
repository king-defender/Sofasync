'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tv, Sparkles, Monitor, Users, Shield, Zap, ArrowRight, Video } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const handleGuestLogin = async () => {
    setLoadingGuest(true);
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' });
      if (res.ok) {
        router.push('/dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Dynamic Ambient Background Glows - much lower opacity in light mode;
          the same values that glow nicely against a near-black canvas read
          as a flat gray-lavender wash against a near-white one */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 dark:bg-primary/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-secondary/5 dark:bg-secondary/15 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Hero Content */}
      <div className="max-w-4xl text-center space-y-8 z-10 py-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Zero Setup Screen & Media Watch-Along
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-gray-900 via-gray-800 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-400 bg-clip-text text-transparent leading-[1.1]">
          Watch Together. <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
            Like Being on the Same Couch.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
          Share your screen or play local video files in real time. Watch movies, sports, or shows with live webcam feeds and room chat — with zero subscription limits or file uploads.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover text-foreground text-base font-bold rounded-2xl glow-button transition-all flex items-center justify-center gap-2"
          >
            Create Account
            <ArrowRight className="w-5 h-5" />
          </Link>

          <button
            onClick={handleGuestLogin}
            disabled={loadingGuest}
            className="w-full sm:w-auto px-8 py-4 glass-card hover:bg-foreground/10 text-foreground text-base font-semibold rounded-2xl border border-foreground/10 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            {loadingGuest ? 'Starting Session...' : 'Instant Guest Start'}
          </button>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          <div className="glass-panel p-6 rounded-2xl border border-foreground/10 hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center mb-4">
              <Monitor className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Screen Share & Local Video</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Broadcast your browser tab, Netflix, or pick an MP4 file directly from your machine. No file upload required.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-foreground/10 hover:border-accent/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center mb-4">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Webcam + Real-Time Chat</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              See reactions live with webcam bubbles, emoji reactions, and movie-moment timestamp tags (`🔥 at 32:10`).
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-foreground/10 hover:border-pink-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Stranger Matchmaking</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Looking for a watch buddy? Enter the queue with genre and language filters to be paired automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
