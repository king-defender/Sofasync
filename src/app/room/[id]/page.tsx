'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RoomClient from '@/components/room/RoomClient';

export default function RoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);

        // Join room API check (FR-2.6/2.7: cap 4 users)
        const joinRes = await fetch(`/api/rooms/${params.id}/join`, { method: 'POST' });
        if (!joinRes.ok) {
          const jData = await joinRes.json();
          alert(jData.error || 'Failed to join room');
          router.push('/dashboard');
          return;
        }
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center text-gray-400 text-sm">
        Connecting to watch room...
      </div>
    );
  }

  return <RoomClient roomId={params.id} currentUser={currentUser} />;
}
