'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Play, Monitor, FileVideo, Youtube, RefreshCw } from 'lucide-react';

const SOURCE_ICON: Record<string, any> = {
  SCREEN_SHARE: Monitor,
  LOCAL_FILE: FileVideo,
  YOUTUBE: Youtube,
};

const SOURCE_LABEL: Record<string, string> = {
  SCREEN_SHARE: 'Screen Share',
  LOCAL_FILE: 'Local File',
  YOUTUBE: 'YouTube',
};

export default function LobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicRooms();
  }, []);

  const fetchPublicRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms?scope=public');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Public Lobby</h1>
            <p className="text-xs text-gray-400">Open rooms anyone can drop into — no invite needed.</p>
          </div>
        </div>
        <button
          onClick={fetchPublicRooms}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="glass-panel p-10 rounded-2xl text-center border border-white/5 space-y-2">
          <p className="text-sm text-gray-400">No public rooms open right now.</p>
          <Link href="/dashboard" className="text-primary text-xs font-semibold hover:underline">
            Start one from your dashboard and toggle "Make it public"
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((r) => {
            const Icon = SOURCE_ICON[r.mediaSource] || Monitor;
            const full = r.participants.length >= 4;
            return (
              <div
                key={r.id}
                className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                      <Icon className="w-3 h-3" />
                      {SOURCE_LABEL[r.mediaSource] || r.mediaSource}
                    </span>
                    <span className={`text-xs ${full ? 'text-red-400' : 'text-gray-400'}`}>
                      {r.participants.length}/4 {full ? '(Full)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={r.host.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                    <h3 className="font-bold text-white text-sm">{r.host.displayName}'s room</h3>
                  </div>
                </div>

                <Link
                  href={full ? '#' : `/room/${r.id}`}
                  aria-disabled={full}
                  className={`mt-4 w-full py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                    full
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed pointer-events-none'
                      : 'bg-white/10 hover:bg-primary text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {full ? 'Room Full' : 'Join Room'}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
