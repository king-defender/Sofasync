'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  FileVideo,
  Send,
  Smile,
  Clock,
  UserPlus,
  AlertTriangle,
  LogOut,
  Copy,
  Check,
  Star,
  Sparkles,
  StopCircle,
} from 'lucide-react';

interface RoomClientProps {
  roomId: string;
  currentUser: any;
}

export default function RoomClient({ roomId, currentUser }: RoomClientProps) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  // Room state
  const [room, setRoom] = useState<any>(null);
  const [mediaSource, setMediaSource] = useState<'SCREEN_SHARE' | 'LOCAL_FILE'>('SCREEN_SHARE');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local media stream refs & states
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const localMediaFileRef = useRef<HTMLInputElement | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const activeMovieStreamRef = useRef<MediaStream | null>(null);

  // Webcam & Audio controls
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const localWebcamRef = useRef<HTMLVideoElement | null>(null);
  const [localWebcamStream, setLocalWebcamStream] = useState<MediaStream | null>(null);

  // Participants & Remote WebRTC streams
  const [participants, setParticipants] = useState<any[]>([]);
  const peerConnections = useRef<{ [userId: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [userId: string]: MediaStream }>({});

  // Which incoming video track IDs are the movie feed (not webcam) - set via
  // explicit signaling rather than sniffing event.track.label, which only
  // ever contains "screen" for getDisplayMedia() and is blank for a local
  // file's captureStream(), silently misrouting the local-media path.
  const movieTrackIds = useRef<Set<string>>(new Set());
  const pendingTrackClassification = useRef<{ [trackId: string]: { peerId: string; stream: MediaStream } }>({});

  // Real-time Chat
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportReason, setReportReason] = useState('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Contacts
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    fetchRoomDetails();
    fetchContacts();
    initWebcam();

    // Socket.IO init
    const socket = io();
    socketRef.current = socket;

    socket.emit('room:join', {
      roomId,
      userId: currentUser.id,
      displayName: currentUser.displayName,
    });

    socket.on('chat:history', (history: any[]) => {
      setMessages(history);
    });

    socket.on('message:receive', (msg: any) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('message:reaction-updated', ({ messageId, emoji, userId, added }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId) {
            const reactions = m.reactions || [];
            if (added) {
              return { ...m, reactions: [...reactions, { messageId, emoji, userId }] };
            } else {
              return {
                ...m,
                reactions: reactions.filter(
                  (r: any) => !(r.messageId === messageId && r.emoji === emoji && r.userId === userId)
                ),
              };
            }
          }
          return m;
        })
      );
    });

    socket.on('participant:joined', ({ userId, displayName }) => {
      fetchRoomDetails();
      initPeerConnection(userId, true);
    });

    socket.on('participant:left', ({ userId }) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
      }
      setRemoteStreams((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
      fetchRoomDetails();
    });

    socket.on('room:media-source-changed', ({ mediaSource }) => {
      setMediaSource(mediaSource);
    });

    socket.on('room:movie-stream-stopped', () => {
      if (mainVideoRef.current && !isHost) {
        mainVideoRef.current.srcObject = null;
        mainVideoRef.current.src = '';
      }
    });

    socket.on('webrtc:offer', async ({ targetUserId, sdp, senderUserId }) => {
      if (targetUserId === currentUser.id) {
        const pc = await initPeerConnection(senderUserId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          targetUserId: senderUserId,
          sdp: answer,
          senderUserId: currentUser.id,
        });
      }
    });

    socket.on('webrtc:answer', async ({ targetUserId, sdp, senderUserId }) => {
      if (targetUserId === currentUser.id) {
        const pc = peerConnections.current[senderUserId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      }
    });

    socket.on('webrtc:ice-candidate', async ({ targetUserId, candidate, senderUserId }) => {
      if (targetUserId === currentUser.id) {
        const pc = peerConnections.current[senderUserId];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    });

    // Tells us which incoming track IDs are the movie feed vs. webcam - see
    // movieTrackIds above for why label-sniffing doesn't work here.
    socket.on('webrtc:track-added', ({ trackId, trackKind }: { trackId?: string; trackKind?: string }) => {
      if (trackKind !== 'movie' || !trackId) return;
      movieTrackIds.current.add(trackId);

      const pending = pendingTrackClassification.current[trackId];
      if (pending) {
        if (mainVideoRef.current) {
          mainVideoRef.current.srcObject = pending.stream;
          mainVideoRef.current.play();
        }
        setRemoteStreams((prev) => {
          const updated = { ...prev };
          delete updated[pending.peerId];
          return updated;
        });
        delete pendingTrackClassification.current[trackId];
      }
    });

    return () => {
      socket.disconnect();
      if (localWebcamStream) {
        localWebcamStream.getTracks().forEach((track) => track.stop());
      }
      if (activeMovieStreamRef.current) {
        activeMovieStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      Object.values(peerConnections.current).forEach((pc) => pc.close());
    };
  }, [roomId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchRoomDetails = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        setMediaSource(data.room.mediaSource);
        setIsHost(data.room.hostId === currentUser.id);
        setParticipants(data.room.participants || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize local webcam (FR-5.1 - FR-5.4)
  const initWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalWebcamStream(stream);
      if (localWebcamRef.current) {
        localWebcamRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Webcam permission denied or unavailable:', err);
      setCameraOn(false);
      setMicOn(false);
    }
  };

  const toggleCamera = () => {
    if (localWebcamStream) {
      const videoTrack = localWebcamStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !cameraOn;
        setCameraOn(!cameraOn);
        socketRef.current?.emit('participant:media-state', {
          roomId,
          userId: currentUser.id,
          cameraOn: !cameraOn,
          micOn,
        });
      }
    }
  };

  const toggleMic = () => {
    if (localWebcamStream) {
      const audioTrack = localWebcamStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
        socketRef.current?.emit('participant:media-state', {
          roomId,
          userId: currentUser.id,
          cameraOn,
          micOn: !micOn,
        });
      }
    }
  };

  // Broadcast movie stream across WebRTC peers
  const broadcastMovieStream = (stream: MediaStream) => {
    activeMovieStreamRef.current = stream;
    Object.values(peerConnections.current).forEach((pc) => {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        if (track.kind === 'video') {
          socketRef.current?.emit('webrtc:track-added', { trackId: track.id, trackKind: 'movie' });
        }
      });
    });
    socketRef.current?.emit('room:movie-stream-started', { roomId, streamType: mediaSource });
  };

  // Screen Share Broadcast (FR-2.3)
  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (mainVideoRef.current) {
        mainVideoRef.current.srcObject = displayStream;
        mainVideoRef.current.play();
      }
      setIsBroadcasting(true);
      broadcastMovieStream(displayStream);

      // Handle user stopping share from browser banner
      displayStream.getVideoTracks()[0].onended = () => {
        stopBroadcasting();
      };
    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  // Local File Selection Broadcast (FR-2.4)
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
      if (mainVideoRef.current) {
        mainVideoRef.current.src = url;
        mainVideoRef.current.play();

        // Capture stream from video element to broadcast to peers
        try {
          const stream = (mainVideoRef.current as any).captureStream
            ? (mainVideoRef.current as any).captureStream()
            : (mainVideoRef.current as any).mozCaptureStream
            ? (mainVideoRef.current as any).mozCaptureStream()
            : null;

          if (stream) {
            broadcastMovieStream(stream);
          }
        } catch (err) {
          console.warn('captureStream warning:', err);
        }
      }
      setIsBroadcasting(true);
    }
  };

  // Stop Broadcast / Stop Screen Share
  const stopBroadcasting = () => {
    if (activeMovieStreamRef.current) {
      activeMovieStreamRef.current.getTracks().forEach((t) => t.stop());
      activeMovieStreamRef.current = null;
    }

    if (mainVideoRef.current) {
      mainVideoRef.current.srcObject = null;
      mainVideoRef.current.src = '';
    }

    setIsBroadcasting(false);
    socketRef.current?.emit('room:movie-stream-stopped', { roomId });
  };

  // Switch Media Source Mid-Session (FR-2.5)
  const handleSwitchMediaSource = async (newSource: 'SCREEN_SHARE' | 'LOCAL_FILE') => {
    try {
      if (isBroadcasting) {
        stopBroadcasting();
      }
      const res = await fetch(`/api/rooms/${roomId}/media-source`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaSource: newSource }),
      });
      if (res.ok) {
        setMediaSource(newSource);
        socketRef.current?.emit('room:media-source-changed', { roomId, mediaSource: newSource });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // WebRTC Peer Connection Setup
  const initPeerConnection = async (targetUserId: string, isInitiator: boolean) => {
    if (peerConnections.current[targetUserId]) {
      return peerConnections.current[targetUserId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnections.current[targetUserId] = pc;

    if (localWebcamStream) {
      localWebcamStream.getTracks().forEach((track) => pc.addTrack(track, localWebcamStream));
    }

    if (activeMovieStreamRef.current) {
      activeMovieStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, activeMovieStreamRef.current!);
        if (track.kind === 'video') {
          socketRef.current?.emit('webrtc:track-added', { trackId: track.id, trackKind: 'movie' });
        }
      });
    }

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      const trackId = event.track.id;

      // Route the movie feed to the main player, webcam tracks to the bubble
      // row. Which track IS the movie feed is decided by explicit signaling
      // (movieTrackIds), not by sniffing event.track.label - that only ever
      // says "screen" for a screen-share; a local file's captureStream()
      // track has no such label and would otherwise land in a webcam bubble.
      if (event.track.kind === 'video' && movieTrackIds.current.has(trackId)) {
        if (mainVideoRef.current) {
          mainVideoRef.current.srcObject = incomingStream;
          mainVideoRef.current.play();
        }
      } else {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetUserId]: incomingStream,
        }));

        if (event.track.kind === 'video') {
          // Not yet known to be the movie track - the "movie" classification
          // may simply not have arrived yet. Keep it as a candidate so it can
          // be moved to the main player the moment that message lands.
          pendingTrackClassification.current[trackId] = { peerId: targetUserId, stream: incomingStream };
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc:ice-candidate', {
          targetUserId,
          candidate: event.candidate,
          senderUserId: currentUser.id,
        });
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc:offer', {
        targetUserId,
        sdp: offer,
        senderUserId: currentUser.id,
      });
    }

    return pc;
  };

  // Chat message send (FR-6.1 - FR-6.6)
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    let timestamp: number | undefined = undefined;
    if (mediaSource === 'LOCAL_FILE' && mainVideoRef.current) {
      timestamp = Math.floor(mainVideoRef.current.currentTime);
    }

    socketRef.current?.emit('message:send', {
      roomId,
      senderId: currentUser.id,
      content: inputMessage.trim(),
      videoTimestamp: timestamp,
    });

    setInputMessage('');
  };

  const handleReact = (messageId: string, emoji: string) => {
    socketRef.current?.emit('message:react', { messageId, emoji, userId: currentUser.id });
    setShowEmojiPicker(null);
  };

  const seekVideoToTimestamp = (seconds: number) => {
    if (mediaSource === 'LOCAL_FILE' && mainVideoRef.current) {
      mainVideoRef.current.currentTime = seconds;
      mainVideoRef.current.play();
    }
  };

  const formatTimestamp = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainderSecs = Math.floor(sec % 60);
    return `${mins}:${remainderSecs < 10 ? '0' : ''}${remainderSecs}`;
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendBuddyInvite = async (receiverId: string) => {
    try {
      const res = await fetch('/api/buddy-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, roomId }),
      });
      if (res.ok) {
        alert('Room invite sent to buddy!');
        setShowInviteModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const submitReport = async () => {
    if (!reportTargetId) return;
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedId: reportTargetId,
          roomId,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      if (res.ok) {
        alert('Report filed to Super Admin moderation team.');
        setShowReportModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveRoom = async () => {
    if (isBroadcasting) {
      stopBroadcasting();
    }
    await fetch(`/api/rooms/${roomId}/leave`, { method: 'POST' });
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    try {
      await fetch(`/api/rooms/${roomId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
    } catch (e) {}
    router.push('/dashboard');
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-background flex flex-col">
      {/* Top Room Control Bar */}
      <div className="glass-panel px-6 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            Watch Room <span className="text-gray-400 font-mono text-xs">({roomId})</span>
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold uppercase">
            {mediaSource === 'SCREEN_SHARE' ? 'Screen Share' : 'Local File'} Mode
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Stop Screen Share / Stop Broadcast Option */}
          {isHost && isBroadcasting && (
            <button
              onClick={stopBroadcasting}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 transition-all shadow"
            >
              <StopCircle className="w-4 h-4 text-red-400" />
              Stop Sharing Screen
            </button>
          )}

          {/* Host Switch Source */}
          {isHost && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => handleSwitchMediaSource('SCREEN_SHARE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mediaSource === 'SCREEN_SHARE' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Screen Share
              </button>
              <button
                onClick={() => handleSwitchMediaSource('LOCAL_FILE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mediaSource === 'LOCAL_FILE' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileVideo className="w-3.5 h-3.5" />
                Local File
              </button>
            </div>
          )}

          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            Invite Buddy
          </button>

          <button
            onClick={copyRoomLink}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Share Link'}
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
            title="Report participant"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>

          <button
            onClick={handleLeaveRoom}
            className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave Room
          </button>
        </div>
      </div>

      {/* Main Layout A Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 relative overflow-hidden">
        {/* Dominant Movie Video Feed Area (cols 1-9) */}
        <div className="lg:col-span-9 bg-black relative flex flex-col items-center justify-center min-h-[500px]">
          {/* Main Broadcast Video Canvas */}
          <video
            ref={mainVideoRef}
            controls
            autoPlay
            playsInline
            className="w-full h-full max-h-[82vh] object-contain"
          />

          {/* Stop Sharing Button Overlay over Video when broadcasting */}
          {isBroadcasting && isHost && (
            <div className="absolute top-4 right-4 z-30">
              <button
                onClick={stopBroadcasting}
                className="px-3.5 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-all border border-red-400/30"
              >
                <StopCircle className="w-4 h-4" />
                Stop Sharing Screen
              </button>
            </div>
          )}

          {/* Broadcast Trigger Overlays for Host */}
          {!isBroadcasting && isHost && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-10">
              {mediaSource === 'SCREEN_SHARE' ? (
                <div className="glass-card p-8 rounded-2xl max-w-md border border-primary/30 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                    <Monitor className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Start Screen Broadcast</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Share your screen, browser tab, or Netflix window with the room.
                    </p>
                  </div>
                  <button
                    onClick={startScreenShare}
                    className="w-full py-3 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2"
                  >
                    <Monitor className="w-4 h-4" />
                    Share My Screen
                  </button>
                </div>
              ) : (
                <div className="glass-card p-8 rounded-2xl max-w-md border border-accent/30 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-accent/20 text-accent flex items-center justify-center">
                    <FileVideo className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Select Local Media File</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Choose an MP4/WebM video from your device to play locally for everyone.
                    </p>
                  </div>
                  <input
                    ref={localMediaFileRef}
                    type="file"
                    accept="video/*"
                    onChange={handleLocalFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => localMediaFileRef.current?.click()}
                    className="w-full py-3 bg-accent hover:bg-purple-600 text-white text-sm font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2"
                  >
                    <FileVideo className="w-4 h-4" />
                    Pick Video File
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Floating Webcam Bubbles Overlay (Bottom-Left Corner per Layout A) */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 max-w-full overflow-x-auto p-2 glass-panel rounded-2xl border border-white/10">
            {/* Local User Webcam */}
            <div className="relative w-28 h-20 bg-card rounded-xl overflow-hidden border border-primary/40 flex-shrink-0 shadow-lg">
              {cameraOn ? (
                <video
                  ref={localWebcamRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400">
                  <span className="font-bold text-sm text-indigo-300">You</span>
                </div>
              )}
              <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white">
                You
              </div>
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <button
                  onClick={toggleCamera}
                  className={`p-1 rounded-full ${cameraOn ? 'bg-black/60 text-white' : 'bg-red-500 text-white'}`}
                >
                  {cameraOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                </button>
                <button
                  onClick={toggleMic}
                  className={`p-1 rounded-full ${micOn ? 'bg-black/60 text-white' : 'bg-red-500 text-white'}`}
                >
                  {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Remote Peer Webcams */}
            {Object.keys(remoteStreams).map((peerId) => (
              <div
                key={peerId}
                className="relative w-28 h-20 bg-card rounded-xl overflow-hidden border border-white/20 flex-shrink-0 shadow-lg"
              >
                <video
                  ref={(el) => {
                    if (el && remoteStreams[peerId]) el.srcObject = remoteStreams[peerId];
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white">
                  Peer
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Chat Sidebar (cols 10-12 per Layout A) */}
        <div className="lg:col-span-3 glass-panel border-l border-border flex flex-col h-[calc(100vh-125px)]">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Room Chat</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
                {participants.length}/4 Users
              </span>
            </h3>
          </div>

          {/* Messages Container */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1 group">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-indigo-300">
                    {msg.sender?.displayName || 'User'}
                  </span>
                  <span className="text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-xs text-gray-200 relative group">
                  <p>{msg.content}</p>

                  {/* Local-media timestamp comment tag (FR-6.6) */}
                  {msg.videoTimestamp !== null && msg.videoTimestamp !== undefined && (
                    <button
                      onClick={() => seekVideoToTimestamp(msg.videoTimestamp)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
                    >
                      <Clock className="w-3 h-3" />
                      Jump to {formatTimestamp(msg.videoTimestamp)}
                    </button>
                  )}

                  {/* Emoji Reactions display */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.reactions.map((r: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-[11px] bg-black/40 px-1.5 py-0.5 rounded-full border border-white/10"
                        >
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Quick Reaction Button */}
                  <button
                    onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                    className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 bg-card p-1 rounded-full text-gray-400 hover:text-amber-400 transition-opacity border border-white/10"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {/* Emoji Picker Popup */}
                  {showEmojiPicker === msg.id && (
                    <div className="absolute right-0 top-6 glass-panel p-1.5 rounded-xl flex gap-1 z-30 shadow-xl border border-white/10">
                      {['🔥', '❤️', '😂', '😮', '👏'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(msg.id, emoji)}
                          className="hover:scale-125 transition-transform p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-border bg-card/50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Send reaction or comment..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSendMessage}
                className="p-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white shadow transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Buddy Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-border">
            <h3 className="text-lg font-bold text-white mb-4">Invite Friend to Watch</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
              {contacts.length === 0 ? (
                <p className="text-xs text-gray-400">No accepted contacts found. Add contacts first!</p>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                      <span className="text-xs font-semibold text-white">{c.displayName}</span>
                    </div>
                    <button
                      onClick={() => sendBuddyInvite(c.id)}
                      className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg glow-button"
                    >
                      Send Invite
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full py-2 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Report Participant Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-red-500/30">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              File Safety Report
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Reports are confidentially submitted directly to Super Admin moderators.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Target Participant</label>
                <select
                  value={reportTargetId}
                  onChange={(e) => setReportTargetId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white"
                >
                  <option value="">Select participant...</option>
                  {participants
                    .filter((p) => p.userId !== currentUser.id)
                    .map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.user?.displayName || p.userId}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white"
                >
                  <option value="HARASSMENT">Harassment or Hate Speech</option>
                  <option value="INAPPROPRIATE_CONTENT">Inappropriate Content</option>
                  <option value="SPAM">Spam or Abuse</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Details</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white h-20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-bold text-white rounded-xl shadow"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Session Review Rating Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-primary/30 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Rate Watch Experience</h3>
            <p className="text-xs text-gray-400 mt-1 mb-4">How was your session with your watch buddies?</p>

            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="p-1 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Add optional comment..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white h-16 mb-4"
            />

            <button
              onClick={submitReview}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl glow-button"
            >
              Done & Return Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
