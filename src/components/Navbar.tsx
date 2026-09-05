'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tv, Bell, Shield, LogOut, User as UserIcon, Sparkles, Users } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchNotifications();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount((data.notifications || []).filter((n: any) => !n.isRead).length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
    router.push('/login');
  };

  const markRead = async () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs && unreadCount > 0) {
      await fetch('/api/notifications', { method: 'PATCH' });
      setUnreadCount(0);
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border/50 px-6 py-3.5 flex items-center justify-between">
      {/* Brand Logo */}
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <Tv className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            SofaSync
          </span>
          <span className="text-[10px] block font-semibold text-primary tracking-widest uppercase -mt-1">
            Watch Together
          </span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex items-center gap-4">
        {user ? (
          <>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Dashboard
            </Link>

            <Link
              href="/matchmaking"
              className="text-sm font-medium text-indigo-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Find Buddy
            </Link>

            {user.role === 'SUPER_ADMIN' && (
              <Link
                href="/admin"
                className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
              >
                <Shield className="w-4 h-4" />
                Admin Panel
              </Link>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={markRead}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 relative transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popup */}
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl shadow-2xl p-4 border border-border z-50">
                  <h4 className="text-xs font-semibold uppercase text-gray-400 mb-3 tracking-wider">
                    Notifications
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="text-xs p-2.5 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-1"
                        >
                          <span className="font-semibold text-indigo-300">
                            {n.type === 'BUDDY_REQUEST'
                              ? '📨 Buddy Room Invite'
                              : n.type === 'BADGE_EARNED'
                              ? '🏆 Badge Earned!'
                              : n.type === 'ROOM_INVITE_ACCEPTED'
                              ? '🎉 Invite Accepted!'
                              : 'Notification'}
                          </span>
                          <p className="text-gray-300">
                            {n.payload?.senderName
                              ? `${n.payload.senderName} invited you to watch!`
                              : n.payload?.badgeName
                              ? `You earned the '${n.payload.badgeName}' badge!`
                              : 'You have a new update.'}
                          </p>
                          {n.payload?.roomId && (
                            <Link
                              href={`/room/${n.payload.roomId}`}
                              className="text-[11px] text-primary hover:underline mt-1 font-semibold block"
                            >
                              Join Room →
                            </Link>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Pill */}
            <div className="flex items-center gap-3 pl-2 border-l border-white/10">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`}
                alt={user.displayName}
                className="w-8 h-8 rounded-full border border-primary/50 object-cover"
              />
              <span className="text-sm font-semibold text-gray-200 hidden md:inline">
                {user.displayName}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg glow-button transition-all"
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
