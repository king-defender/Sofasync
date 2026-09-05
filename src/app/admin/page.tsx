'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  AlertTriangle,
  Users,
  Tv,
  Award,
  CheckCircle,
  XCircle,
  FileText,
  UserCheck,
  UserX,
  Plus,
  Search,
  Mail,
  Settings as SettingsIcon,
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'badges' | 'logs' | 'users' | 'settings'>('reports');

  // User management
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Feature-flag settings
  const [settings, setSettings] = useState<any>(null);

  // Resolution note state
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // New badge state
  const [badgeName, setBadgeName] = useState('');
  const [badgeDesc, setBadgeDesc] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('🏆');

  useEffect(() => {
    fetchDashboardData();
    fetchReports();
    fetchBadges();
    fetchUsers();
    fetchSettings();
  }, []);

  const fetchUsers = async (q?: string) => {
    try {
      const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSetting = async (key: string) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next); // optimistic
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      } else {
        setSettings(settings); // revert on failure
      }
    } catch (e) {
      setSettings(settings);
    }
  };

  const toggleUserVerified = async (userId: string, currentVerified: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVerified: !currentVerified }),
      });
      if (res.ok) fetchUsers(userSearch);
    } catch (e) {
      console.error(e);
    }
  };

  const resendVerification = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend-verification`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || data.error);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.status === 403) {
        alert('Access denied: Super Admin role required');
        router.push('/dashboard');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/admin/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBadges = async () => {
    try {
      const res = await fetch('/api/admin/badges');
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateReportStatus = async (reportId: string, status: 'ACTIONED' | 'DISMISSED') => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNote }),
      });
      if (res.ok) {
        setSelectedReport(null);
        setResolutionNote('');
        fetchReports();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleUserSuspension = async (userId: string, currentSuspended: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !currentSuspended }),
      });
      if (res.ok) {
        fetchReports();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateBadge = async () => {
    if (!badgeName || !badgeDesc) return;
    try {
      const res = await fetch('/api/admin/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: badgeName, description: badgeDesc, iconUrl: badgeIcon }),
      });
      if (res.ok) {
        setBadgeName('');
        setBadgeDesc('');
        fetchBadges();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Admin Header */}
      <div className="glass-panel p-8 rounded-3xl border border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Super Admin Moderation Panel</h1>
            <p className="text-xs text-gray-400">Manage safety reports, suspensions, and badges</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-medium">Active Rooms</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">{stats?.activeRooms ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <Tv className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-medium">Users in Queue</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">{stats?.queuedUsers ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-medium">Open Safety Reports</span>
            <h3 className="text-2xl font-extrabold text-amber-400 mt-1">{stats?.openReports ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-medium">Total Platform Users</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">{stats?.totalUsers ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-border pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'reports' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Safety Reports Queue ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'badges' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Badge Catalog ({badges.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logs' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Admin Action Logs
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'settings' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Feature Settings
        </button>
      </div>

      {/* Tab: User Management */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                fetchUsers(e.target.value);
              }}
              placeholder="Search by name or email..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-gray-400 uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Verified</th>
                  <th className="p-4">Badges</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {u.displayName}
                              {u.isSuspended && (
                                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-bold">
                                  Suspended
                                </span>
                              )}
                              {u.isGuest && (
                                <span className="text-[9px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase font-bold">
                                  Guest
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-indigo-300">{u.role}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {u.isVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{u._count?.badges ?? 0}</td>
                      <td className="p-4 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserVerified(u.id, u.isVerified)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            u.isVerified
                              ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          }`}
                        >
                          {u.isVerified ? 'Unverify' : 'Verify'}
                        </button>
                        {!u.isVerified && !u.isGuest && (
                          <button
                            onClick={() => resendVerification(u.id)}
                            title="Resend verification email"
                            className="px-2 py-1 rounded-lg text-xs font-bold bg-white/10 text-gray-300 hover:bg-white/20 inline-flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleUserSuspension(u.id, u.isSuspended)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            u.isSuspended
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Feature Settings */}
      {activeTab === 'settings' && settings && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          {[
            {
              key: 'requireEmailVerification',
              title: 'Require email verification',
              desc: 'When off, new signups are auto-verified and existing unverified accounts can log in immediately. Use this if SMTP isn’t delivering.',
            },
            { key: 'guestAccessEnabled', title: 'Guest access', desc: '"Instant Guest Start" on the homepage.' },
            { key: 'matchmakingEnabled', title: 'Stranger matchmaking', desc: 'The "Find a Buddy" queue.' },
            { key: 'publicLobbyEnabled', title: 'Public lobby', desc: 'Rooms marked public and the /lobby page.' },
            { key: 'oauthGoogleEnabled', title: 'Google sign-in', desc: 'Kill switch independent of whether credentials are configured.' },
            { key: 'oauthGithubEnabled', title: 'GitHub sign-in', desc: 'Kill switch independent of whether credentials are configured.' },
            { key: 'oauthDiscordEnabled', title: 'Discord sign-in', desc: 'Kill switch independent of whether credentials are configured.' },
          ].map((flag) => (
            <div
              key={flag.key}
              className="glass-panel p-4 rounded-2xl border border-white/10 flex items-start justify-between gap-3"
            >
              <div>
                <h4 className="font-bold text-white text-sm">{flag.title}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{flag.desc}</p>
              </div>
              <button
                onClick={() => toggleSetting(flag.key)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  settings[flag.key] ? 'bg-primary' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings[flag.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 1: Safety Reports Queue */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-gray-400 uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-4">Reporter</th>
                  <th className="p-4">Reported User</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No reports filed.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="p-4 font-semibold text-white">{r.reporter?.displayName}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-red-400">{r.reported?.displayName}</span>
                          {r.reported?.isSuspended && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase font-bold">
                              Suspended
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-indigo-300">{r.reason}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'OPEN'
                              ? 'bg-amber-500/20 text-amber-400'
                              : r.status === 'ACTIONED'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedReport(r)}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => toggleUserSuspension(r.reportedId, r.reported?.isSuspended)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            r.reported?.isSuspended
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {r.reported?.isSuspended ? 'Unsuspend' : 'Suspend User'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Badge Catalog Builder */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-bold text-white text-sm">Create New Badge</h3>
            <input
              type="text"
              placeholder="Badge Name (e.g. Night Owl)"
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Description"
              value={badgeDesc}
              onChange={(e) => setBadgeDesc(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Icon Emoji (e.g. 🦉)"
              value={badgeIcon}
              onChange={(e) => setBadgeIcon(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white"
            />
            <button
              onClick={handleCreateBadge}
              className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl glow-button"
            >
              Add Badge Definition
            </button>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {badges.map((b) => (
              <div key={b.id} className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
                <span className="text-3xl">{b.iconUrl || '🏆'}</span>
                <div>
                  <h4 className="font-bold text-white text-sm">{b.name}</h4>
                  <p className="text-xs text-gray-400">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Admin Action Audit Logs */}
      {activeTab === 'logs' && (
        <div className="glass-panel rounded-2xl border border-white/5 p-4 space-y-2 max-h-96 overflow-y-auto">
          {stats?.recentLogs?.map((log: any) => (
            <div key={log.id} className="p-3 rounded-xl bg-white/5 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-indigo-300">{log.admin?.displayName}: </span>
                <span className="text-white font-mono">{log.action} </span>
                <span className="text-gray-400">on {log.targetType} ({log.targetId})</span>
              </div>
              <span className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-border space-y-4">
            <h3 className="text-lg font-bold text-white">Review Report Details</h3>
            <p className="text-xs text-gray-300">
              <strong>Details:</strong> {selectedReport.details || 'No details provided'}
            </p>

            <textarea
              placeholder="Resolution note (e.g. Warning issued to user)..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white h-24"
            />

            <div className="flex gap-3">
              <button
                onClick={() => updateReportStatus(selectedReport.id, 'DISMISSED')}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold rounded-xl"
              >
                Dismiss
              </button>
              <button
                onClick={() => updateReportStatus(selectedReport.id, 'ACTIONED')}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
              >
                Mark Actioned
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
