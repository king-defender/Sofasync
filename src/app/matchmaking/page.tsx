'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { Sparkles, Video, Globe, Film, Search, X, Check } from 'lucide-react';

export default function MatchmakingPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inQueue, setInQueue] = useState(false);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queueTime, setQueueTime] = useState(0);

  // Filters (FR-4.1)
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [cameraPref, setCameraPref] = useState(true);
  const [ageRangeMin, setAgeRangeMin] = useState(18);
  const [ageRangeMax, setAgeRangeMax] = useState(35);

  useEffect(() => {
    fetchUser();
    const socket = io();
    socketRef.current = socket;

    socket.on('matchmaking:joined-queue', ({ queueId }) => {
      setQueueId(queueId);
      setInQueue(true);
    });

    socket.on('matchmaking:matched', ({ roomId }) => {
      router.push(`/room/${roomId}`);
    });

    socket.on('matchmaking:left', () => {
      setInQueue(false);
      setQueueId(null);
    });

    socket.on('matchmaking:disabled', () => {
      setInQueue(false);
      alert('Matchmaking is currently disabled by the site admin.');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (inQueue) {
      interval = setInterval(() => setQueueTime((prev) => prev + 1), 1000);
    } else {
      setQueueTime(0);
    }
    return () => clearInterval(interval);
  }, [inQueue]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const joinQueue = () => {
    if (!currentUser) return;
    socketRef.current?.emit('matchmaking:join', {
      userId: currentUser.id,
      filters: {
        genre: genre || null,
        language: language || null,
        cameraPref,
        ageRangeMin,
        ageRangeMax,
      },
    });
  };

  const leaveQueue = () => {
    if (!currentUser) return;
    socketRef.current?.emit('matchmaking:leave', {
      queueId,
      userId: currentUser.id,
    });
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="glass-panel p-8 md:p-10 rounded-3xl border border-border space-y-8 relative overflow-hidden">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center mx-auto mb-2 shadow-lg">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Find a Watch Buddy</h1>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Get paired with someone who wants to watch compatible content in real time.
          </p>
        </div>

        {/* Searching Animation & Queue Status */}
        {inQueue ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"></div>
              <div className="absolute inset-2 rounded-full border-4 border-primary/40 animate-pulse"></div>
              <div className="w-20 h-20 rounded-full bg-primary/30 text-primary flex items-center justify-center shadow-2xl">
                <Search className="w-8 h-8 animate-bounce" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Scanning for Compatible Buddy...</h3>
              <p className="text-xs text-gray-400 mt-1">Queue Time: {formatTimer(queueTime)}</p>
            </div>

            <button
              onClick={leaveQueue}
              className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-xl border border-red-500/30 flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel Queue Search
            </button>
          </div>
        ) : (
          /* Filters Setup Form */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Genre Selection */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-primary" />
                  Preferred Genre
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-primary"
                >
                  <option value="">Any Genre (No preference)</option>
                  <option value="Action">Action & Sci-Fi</option>
                  <option value="Comedy">Comedy</option>
                  <option value="Drama">Drama</option>
                  <option value="Horror">Horror & Thriller</option>
                  <option value="Anime">Anime</option>
                  <option value="Documentary">Documentary</option>
                </select>
              </div>

              {/* Language Selection */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-accent" />
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-accent"
                >
                  <option value="">Any Language</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>

              {/* Camera Preference */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-emerald-400" />
                  Webcam Preference
                </label>
                <button
                  onClick={() => setCameraPref(!cameraPref)}
                  className={`w-full p-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                    cameraPref
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <span>{cameraPref ? 'Camera On Recommended' : 'Camera Optional'}</span>
                  {cameraPref && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>

              {/* Age Range */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Age Range ({ageRangeMin} - {ageRangeMax})
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="range"
                    min="18"
                    max="60"
                    value={ageRangeMin}
                    onChange={(e) => setAgeRangeMin(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min="18"
                    max="60"
                    value={ageRangeMax}
                    onChange={(e) => setAgeRangeMax(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={joinQueue}
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-2xl glow-button transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Enter Matchmaking Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
