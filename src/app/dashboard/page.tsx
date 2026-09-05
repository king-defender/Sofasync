'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Tv,
  Plus,
  Sparkles,
  Users,
  Award,
  Search,
  UserPlus,
  Check,
  Monitor,
  FileVideo,
  Youtube,
  Play,
  Globe,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState<'SCREEN_SHARE' | 'LOCAL_FILE' | 'YOUTUBE'>('SCREEN_SHARE');
  const [makePublic, setMakePublic] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const uData = await userRes.json();
        setUser(uData.user);
      } else {
        router.push('/login');
        return;
      }

      const roomsRes = await fetch('/api/rooms');
      if (roomsRes.ok) {
        const rData = await roomsRes.json();
        setActiveRooms(rData.rooms || []);
      }

      const contactsRes = await fetch('/api/contacts');
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(cData.contacts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRoom = async () => {
    setCreatingRoom(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaSource: selectedSource, isPublic: makePublic }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/room/${data.room.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addContact = async (receiverId: string) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId }),
      });
      if (res.ok) {
        fetchData();
        setSearchResults([]);
        setSearchQuery('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center text-muted-foreground text-sm">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel p-8 rounded-3xl border border-border relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 border-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
                Welcome back, {user.displayName}!
              </h1>
              <p className="text-xs text-muted-foreground">Ready for your next watch session?</p>
            </div>
          </div>
        </div>

        {/* Quick Launch Actions */}
        <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
          <div className="flex items-center bg-foreground/5 p-1 rounded-2xl border border-foreground/10">
            <button
              onClick={() => setSelectedSource('SCREEN_SHARE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedSource === 'SCREEN_SHARE' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Screen Share
            </button>
            <button
              onClick={() => setSelectedSource('LOCAL_FILE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedSource === 'LOCAL_FILE' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <FileVideo className="w-3.5 h-3.5" />
              Local File
            </button>
            <button
              onClick={() => setSelectedSource('YOUTUBE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedSource === 'YOUTUBE' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              YouTube
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMakePublic(!makePublic)}
            title="Anyone can find and join this room from the public lobby"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              makePublic
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                : 'bg-foreground/5 border-foreground/10 text-muted-foreground'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            {makePublic ? 'Public' : 'Private'}
          </button>

          <button
            onClick={handleCreateRoom}
            disabled={creatingRoom}
            className="px-6 py-3 bg-primary hover:bg-primary-hover text-foreground text-xs font-bold rounded-2xl glow-button transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {creatingRoom ? 'Launching...' : 'Create Watch Room'}
          </button>

          <Link
            href="/matchmaking"
            className="px-6 py-3 bg-primary/10 hover:bg-primary/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-2xl border border-primary/30 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            Find a Buddy
          </Link>
        </div>
      </div>

      {/* Grid: Active Rooms & Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Active Rooms (cols 1-8) */}
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary" />
            Live Watch Rooms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRooms.length === 0 ? (
              <div className="col-span-2 glass-panel p-8 rounded-2xl text-center border border-foreground/5 space-y-3">
                <p className="text-sm text-muted-foreground">No active rooms right now.</p>
                <button
                  onClick={handleCreateRoom}
                  className="px-4 py-2 bg-primary/20 text-primary text-xs font-bold rounded-xl hover:bg-primary/30 transition-colors"
                >
                  Start First Room
                </button>
              </div>
            ) : (
              activeRooms.map((r) => (
                <div
                  key={r.id}
                  className="glass-panel p-5 rounded-2xl border border-foreground/10 hover:border-primary/40 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {r.mediaSource === 'SCREEN_SHARE'
                          ? 'Screen Share'
                          : r.mediaSource === 'YOUTUBE'
                          ? 'YouTube'
                          : 'Local File'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.participants.length}/4 Users
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-sm">Host: {r.host.displayName}</h3>
                  </div>

                  <Link
                    href={`/room/${r.id}`}
                    className="mt-4 w-full py-2 bg-foreground/10 hover:bg-primary text-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Join Room
                  </Link>
                </div>
              ))
            )}
          </div>

          {/* Badges Section */}
          <div className="pt-4 space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Earned Badges ({user.badges?.length || 0})
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(user.badges || []).map((ub: any) => (
                <div
                  key={ub.id}
                  className="glass-panel p-3.5 rounded-2xl border border-amber-500/20 flex items-center gap-3"
                >
                  <span className="text-2xl">{ub.badge.iconUrl || '🏆'}</span>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{ub.badge.name}</h4>
                    <p className="text-[10px] text-muted-foreground">{ub.badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Contacts & Add Friends (cols 9-12) */}
        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Watch Buddies ({contacts.length})
          </h2>

          {/* Search Users Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              placeholder="Search user to add contact..."
              className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent"
            />
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="glass-panel rounded-2xl p-3 space-y-2 border border-accent/30">
              <h4 className="text-[10px] uppercase font-bold text-muted-foreground px-1">Search Results</h4>
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-foreground/5">
                  <div className="flex items-center gap-2">
                    <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                    <span className="text-xs font-semibold text-foreground">{u.displayName}</span>
                  </div>
                  <button
                    onClick={() => addContact(u.id)}
                    className="p-1.5 rounded-lg bg-accent text-foreground hover:bg-accent/80 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Contacts List */}
          <div className="glass-panel rounded-2xl p-4 space-y-3 border border-foreground/5 max-h-80 overflow-y-auto">
            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No contacts added yet</p>
            ) : (
              contacts.map((c) => (
                <div
                  key={c.contactId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-foreground/10" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{c.displayName}</h4>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Ready to watch</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
