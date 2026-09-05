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
  Youtube,
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
  Lock,
  Unlock,
  ListVideo,
  MessageSquare,
  Plus,
  X,
  Image as ImageIcon,
  Headphones,
} from 'lucide-react';

interface RoomClientProps {
  roomId: string;
  currentUser: any;
}

// Reads a YouTube video ID out of a pasted link (watch/shorts/youtu.be/embed
// formats) or a bare 11-character ID.
function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null;
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/embed/')[1] || null;
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/shorts/')[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function isImageUrl(content: string): boolean {
  return /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(content.trim());
}

export default function RoomClient({ roomId, currentUser }: RoomClientProps) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  // Room state
  const [room, setRoom] = useState<any>(null);
  const [mediaSource, setMediaSource] = useState<'SCREEN_SHARE' | 'LOCAL_FILE' | 'YOUTUBE'>('SCREEN_SHARE');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  // Synced YouTube playback
  const youtubePlayerRef = useRef<any>(null);
  const applyingRemoteYoutubeUpdate = useRef(false);
  const [currentYoutubeId, setCurrentYoutubeId] = useState<string | null>(null);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [hostControlsOnly, setHostControlsOnly] = useState(true);
  const [favoriteSources, setFavoriteSources] = useState<any[]>([]);
  const hostControlsOnlyRef = useRef(true);
  const isHostRef = useRef(false);
  useEffect(() => { hostControlsOnlyRef.current = hostControlsOnly; }, [hostControlsOnly]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  const canControlYoutube = isHost || !hostControlsOnly;

  // Sidebar tab + GIF input
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'queue'>('chat');
  const [gifTargetOpen, setGifTargetOpen] = useState(false);
  const [gifUrlInput, setGifUrlInput] = useState('');

  // Local media stream refs & states
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const localMediaFileRef = useRef<HTMLInputElement | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const activeMovieStreamRef = useRef<MediaStream | null>(null);

  // ICE servers (STUN + TURN if configured) - fetched once, used for every
  // peer connection. A ref, not state: created fresh per-peer-connection call,
  // no need to re-render when it arrives, just needs to be there by the time
  // the first connection is actually opened.
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);

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
    fetch('/api/ice-servers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers;
        }
      })
      .catch(() => {}); // keep the STUN-only default on failure

    fetchRoomDetails();
    fetchContacts();
    fetchFavorites();
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

    socket.on('youtube:load', ({ youtubeId }: { youtubeId: string; title?: string }) => {
      setCurrentYoutubeId(youtubeId);
      ensureYoutubePlayer(youtubeId);
    });

    socket.on('youtube:control', ({ action, time }: { action: string; time: number }) => {
      const player = youtubePlayerRef.current;
      if (!player) return;
      applyingRemoteYoutubeUpdate.current = true;
      if (action === 'play') {
        player.seekTo(time, true);
        player.playVideo();
      } else if (action === 'pause') {
        player.seekTo(time, true);
        player.pauseVideo();
      } else if (action === 'seek') {
        player.seekTo(time, true);
      }
      setTimeout(() => {
        applyingRemoteYoutubeUpdate.current = false;
      }, 400);
    });

    socket.on('playlist:history', (items: any[]) => setPlaylist(items));
    socket.on('playlist:updated', (items: any[]) => setPlaylist(items));
    socket.on('room:settings-update', ({ hostControlsOnly }: { hostControlsOnly: boolean }) => {
      setHostControlsOnly(hostControlsOnly);
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

  // Load the YouTube IFrame API once (idempotent - safe if already present)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).YT?.Player || document.getElementById('youtube-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }, []);

  // Drift-correction heartbeat: whoever's allowed to control playback nudges
  // everyone else back in sync every few seconds, rather than relying on a
  // single seek event (the YouTube IFrame API has no dedicated seek event).
  useEffect(() => {
    const interval = setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player || mediaSource !== 'YOUTUBE' || !canControlYoutube) return;
      if (typeof player.getPlayerState !== 'function') return;
      if (player.getPlayerState() !== 1) return; // only while actually playing
      socketRef.current?.emit('youtube:control', {
        roomId,
        senderId: currentUser.id,
        action: 'seek',
        time: player.getCurrentTime(),
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [mediaSource, canControlYoutube, roomId, currentUser.id]);

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/users/me/favorite-sources');
      if (res.ok) {
        const data = await res.json();
        setFavoriteSources(data.favorites || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const ensureYoutubePlayer = (videoId: string) => {
    const create = () => {
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.loadVideoById(videoId);
        return;
      }
      youtubePlayerRef.current = new (window as any).YT.Player('youtube-player-target', {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          rel: 0,
          controls: isHostRef.current || !hostControlsOnlyRef.current ? 1 : 0,
        },
        events: { onStateChange: handleYoutubeStateChange },
      });
    };

    if ((window as any).YT?.Player) {
      create();
    } else {
      const check = setInterval(() => {
        if ((window as any).YT?.Player) {
          clearInterval(check);
          create();
        }
      }, 250);
    }
  };

  const handleYoutubeStateChange = (event: any) => {
    if (applyingRemoteYoutubeUpdate.current) return;
    if (!canControlYoutube) return;
    const YTState = (window as any).YT?.PlayerState;
    if (!YTState) return;
    const time = event.target.getCurrentTime();
    if (event.data === YTState.PLAYING) {
      socketRef.current?.emit('youtube:control', { roomId, senderId: currentUser.id, action: 'play', time });
    } else if (event.data === YTState.PAUSED) {
      socketRef.current?.emit('youtube:control', { roomId, senderId: currentUser.id, action: 'pause', time });
    }
  };

  const submitLoadAndPlay = () => {
    const id = extractYoutubeId(youtubeUrlInput);
    if (!id) {
      alert("Could not read a YouTube link from that - try pasting the full URL.");
      return;
    }
    socketRef.current?.emit('youtube:load-and-play', { roomId, senderId: currentUser.id, youtubeId: id, title: null });
    setYoutubeUrlInput('');
  };

  const submitAddToQueue = (rawInput?: string) => {
    const id = extractYoutubeId(rawInput ?? youtubeUrlInput);
    if (!id) {
      alert("Could not read a YouTube link from that - try pasting the full URL.");
      return;
    }
    socketRef.current?.emit('playlist:add', { roomId, senderId: currentUser.id, youtubeId: id, title: null });
    if (!rawInput) setYoutubeUrlInput('');
  };

  const playQueueItem = (itemId: string) => {
    socketRef.current?.emit('playlist:play', { roomId, senderId: currentUser.id, itemId });
  };

  const removeQueueItem = (itemId: string) => {
    socketRef.current?.emit('playlist:remove', { roomId, senderId: currentUser.id, itemId });
  };

  const toggleHostLock = () => {
    socketRef.current?.emit('room:settings-update', {
      roomId,
      senderId: currentUser.id,
      hostControlsOnly: !hostControlsOnly,
    });
  };

  const saveFavorite = async (youtubeId: string) => {
    try {
      await fetch('/api/users/me/favorite-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId }),
      });
      fetchFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  const sendGif = (url: string) => {
    if (!url.trim()) return;
    socketRef.current?.emit('message:send', { roomId, senderId: currentUser.id, content: url.trim() });
    setGifUrlInput('');
    setGifTargetOpen(false);
  };

  const fetchRoomDetails = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        setMediaSource(data.room.mediaSource);
        setIsHost(data.room.hostId === currentUser.id);
        setParticipants(data.room.participants || []);
        setHostControlsOnly(data.room.hostControlsOnly ?? true);
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
  const handleSwitchMediaSource = async (newSource: 'SCREEN_SHARE' | 'LOCAL_FILE' | 'YOUTUBE') => {
    try {
      if (isBroadcasting) {
        stopBroadcasting();
      }
      if (newSource !== 'YOUTUBE') {
        setCurrentYoutubeId(null);
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
      iceServers: iceServersRef.current,
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
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            Watch Room <span className="text-muted-foreground font-mono text-xs">({roomId})</span>
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold uppercase">
            {mediaSource === 'SCREEN_SHARE' ? 'Screen Share' : mediaSource === 'YOUTUBE' ? 'YouTube' : 'Local File'} Mode
          </span>
          {mediaSource === 'YOUTUBE' && (
            <span
              title={hostControlsOnly ? 'Only the host can play/pause/seek' : 'Anyone can control playback'}
              className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${
                hostControlsOnly
                  ? 'bg-foreground/5 text-muted-foreground border-foreground/10'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              {hostControlsOnly ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {hostControlsOnly ? 'Host-Only Controls' : 'Open Controls'}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Stop Screen Share / Stop Broadcast Option */}
          {isHost && isBroadcasting && (
            <button
              onClick={stopBroadcasting}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 transition-all shadow"
            >
              <StopCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              Stop Sharing Screen
            </button>
          )}

          {/* Voice-only quick toggle */}
          <button
            onClick={toggleCamera}
            title="Turn your camera off and stay on voice only"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              !cameraOn
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                : 'bg-foreground/5 border-foreground/10 text-muted-foreground'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            Voice Only
          </button>

          {/* Host-lock toggle (YouTube mode only) */}
          {isHost && mediaSource === 'YOUTUBE' && (
            <button
              onClick={toggleHostLock}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-foreground transition-all"
            >
              {hostControlsOnly ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {hostControlsOnly ? 'Let Anyone Control' : 'Lock to Host Only'}
            </button>
          )}

          {/* Host Switch Source */}
          {isHost && (
            <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-xl border border-foreground/10">
              <button
                onClick={() => handleSwitchMediaSource('SCREEN_SHARE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mediaSource === 'SCREEN_SHARE' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Screen Share
              </button>
              <button
                onClick={() => handleSwitchMediaSource('LOCAL_FILE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mediaSource === 'LOCAL_FILE' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileVideo className="w-3.5 h-3.5" />
                Local File
              </button>
              <button
                onClick={() => handleSwitchMediaSource('YOUTUBE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  mediaSource === 'YOUTUBE' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Youtube className="w-3.5 h-3.5" />
                YouTube
              </button>
            </div>
          )}

          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-semibold flex items-center gap-1.5 border border-foreground/10 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            Invite Buddy
          </button>

          <button
            onClick={copyRoomLink}
            className="px-3.5 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-semibold flex items-center gap-1.5 border border-foreground/10 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Share Link'}
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-colors"
            title="Report participant"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>

          <button
            onClick={handleLeaveRoom}
            className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-foreground text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
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
          {/* Main Broadcast Video Canvas (screen-share / local-file paths) */}
          {mediaSource !== 'YOUTUBE' && (
            <video
              ref={mainVideoRef}
              controls
              autoPlay
              playsInline
              className="w-full h-full max-h-[82vh] object-contain"
            />
          )}

          {/* Synced YouTube player */}
          {mediaSource === 'YOUTUBE' && (
            <div id="youtube-player-target" className="w-full h-full max-h-[82vh]" />
          )}

          {/* Stop Sharing Button Overlay over Video when broadcasting */}
          {isBroadcasting && isHost && (
            <div className="absolute top-4 right-4 z-30">
              <button
                onClick={stopBroadcasting}
                className="px-3.5 py-1.5 bg-red-600/90 hover:bg-red-600 text-foreground text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-all border border-red-400/30"
              >
                <StopCircle className="w-4 h-4" />
                Stop Sharing Screen
              </button>
            </div>
          )}

          {/* Broadcast Trigger Overlays for Host */}
          {(mediaSource === 'YOUTUBE' ? !currentYoutubeId : !isBroadcasting && isHost) && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-10">
              {mediaSource === 'YOUTUBE' ? (
                canControlYoutube ? (
                  <div className="glass-card p-8 rounded-2xl max-w-md w-full border border-primary/30 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                      <Youtube className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Watch a YouTube Video Together</h3>
                      <p className="text-xs text-muted-foreground mt-1">Paste a link — everyone's player stays in sync.</p>
                    </div>
                    <div className="w-full flex items-center gap-2">
                      <input
                        type="text"
                        value={youtubeUrlInput}
                        onChange={(e) => setYoutubeUrlInput(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => {
                          const id = extractYoutubeId(youtubeUrlInput);
                          if (id) saveFavorite(id);
                        }}
                        title="Save to favorites"
                        className="p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-amber-600 dark:text-amber-400 flex-shrink-0"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="w-full flex items-center gap-2">
                      <button
                        onClick={submitLoadAndPlay}
                        className="flex-1 py-3 bg-primary hover:bg-primary-hover text-foreground text-sm font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2"
                      >
                        <Youtube className="w-4 h-4" />
                        Load & Watch
                      </button>
                      <button
                        onClick={() => submitAddToQueue()}
                        title="Add to queue instead of playing now"
                        className="px-4 py-3 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Queue
                      </button>
                    </div>
                    {favoriteSources.length > 0 && (
                      <div className="w-full">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 text-left">Favorites</p>
                        <div className="flex flex-wrap gap-1.5">
                          {favoriteSources.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setYoutubeUrlInput(f.youtubeId)}
                              className="text-[11px] px-2 py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground border border-foreground/10"
                            >
                              {f.title || f.youtubeId}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="glass-card p-8 rounded-2xl max-w-md border border-foreground/10 flex flex-col items-center gap-3">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                    <h3 className="text-lg font-bold text-foreground">Waiting for the host</h3>
                    <p className="text-xs text-muted-foreground">Playback is locked to host-only control right now.</p>
                  </div>
                )
              ) : mediaSource === 'SCREEN_SHARE' ? (
                <div className="glass-card p-8 rounded-2xl max-w-md border border-primary/30 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                    <Monitor className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Start Screen Broadcast</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share your screen, browser tab, or Netflix window with the room.
                    </p>
                  </div>
                  <button
                    onClick={startScreenShare}
                    className="w-full py-3 bg-primary hover:bg-primary-hover text-foreground text-sm font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2"
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
                    <h3 className="text-lg font-bold text-foreground">Select Local Media File</h3>
                    <p className="text-xs text-muted-foreground mt-1">
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
                    className="w-full py-3 bg-accent hover:bg-purple-600 text-foreground text-sm font-bold rounded-xl glow-button transition-all flex items-center justify-center gap-2"
                  >
                    <FileVideo className="w-4 h-4" />
                    Pick Video File
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Floating Webcam Bubbles Overlay (Bottom-Left Corner per Layout A) */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 max-w-full overflow-x-auto p-2 glass-panel rounded-2xl border border-foreground/10">
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
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-muted-foreground">
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-300">You</span>
                </div>
              )}
              <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-semibold text-foreground">
                You
              </div>
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <button
                  onClick={toggleCamera}
                  className={`p-1 rounded-full ${cameraOn ? 'bg-black/60 text-foreground' : 'bg-red-500 text-foreground'}`}
                >
                  {cameraOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                </button>
                <button
                  onClick={toggleMic}
                  className={`p-1 rounded-full ${micOn ? 'bg-black/60 text-foreground' : 'bg-red-500 text-foreground'}`}
                >
                  {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Remote Peer Webcams */}
            {Object.keys(remoteStreams).map((peerId) => (
              <div
                key={peerId}
                className="relative w-28 h-20 bg-card rounded-xl overflow-hidden border border-foreground/20 flex-shrink-0 shadow-lg"
              >
                <video
                  ref={(el) => {
                    if (el && remoteStreams[peerId]) el.srcObject = remoteStreams[peerId];
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-semibold text-foreground">
                  Peer
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Chat Sidebar (cols 10-12 per Layout A) */}
        <div className="lg:col-span-3 glass-panel border-l border-border flex flex-col h-[calc(100vh-125px)]">
          {/* Chat / Queue Tab Header */}
          <div className="p-3 border-b border-border flex items-center gap-1.5">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'chat' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setSidebarTab('queue')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'queue' ? 'bg-primary text-foreground shadow' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5" />
              Queue {playlist.length > 0 && `(${playlist.length})`}
            </button>
            <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/10 text-muted-foreground font-mono whitespace-nowrap">
              {participants.length}/4
            </span>
          </div>

          {/* Messages Container */}
          {sidebarTab === 'chat' && (
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1 group">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                    {msg.sender?.displayName || 'User'}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="bg-foreground/5 p-2.5 rounded-xl border border-foreground/5 text-xs text-foreground relative group">
                  {isImageUrl(msg.content) ? (
                    <img src={msg.content} alt="GIF" className="max-w-full max-h-40 rounded-lg" />
                  ) : (
                    <p>{msg.content}</p>
                  )}

                  {/* Local-media timestamp comment tag (FR-6.6) */}
                  {msg.videoTimestamp !== null && msg.videoTimestamp !== undefined && (
                    <button
                      onClick={() => seekVideoToTimestamp(msg.videoTimestamp)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
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
                          className="text-[11px] bg-foreground/10 px-1.5 py-0.5 rounded-full border border-foreground/10"
                        >
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Quick Reaction Button */}
                  <button
                    onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                    className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 bg-card p-1 rounded-full text-muted-foreground hover:text-amber-600 dark:text-amber-400 transition-opacity border border-foreground/10"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {/* Emoji Picker Popup */}
                  {showEmojiPicker === msg.id && (
                    <div className="absolute right-0 top-6 glass-panel p-1.5 rounded-xl flex gap-1 z-30 shadow-xl border border-foreground/10">
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
          )}

          {/* Queue Panel */}
          {sidebarTab === 'queue' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {playlist.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nothing queued yet — add a YouTube link below.</p>
              ) : (
                playlist.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      item.status === 'PLAYING'
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-foreground/5 border-foreground/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{item.title || item.youtubeId}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {item.status === 'PLAYING' ? '▶ Now playing' : 'Queued'} · added by {item.addedBy?.displayName || 'someone'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.status !== 'PLAYING' && canControlYoutube && (
                        <button
                          onClick={() => playQueueItem(item.id)}
                          className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary"
                          title="Play now"
                        >
                          <Youtube className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(item.addedBy?.id === currentUser.id || isHost) && (
                        <button
                          onClick={() => removeQueueItem(item.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* GIF popup */}
          {gifTargetOpen && (
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl p-2">
                <input
                  type="text"
                  value={gifUrlInput}
                  onChange={(e) => setGifUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendGif(gifUrlInput)}
                  placeholder="Paste a GIF/image URL..."
                  className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground focus:outline-none"
                />
                <button onClick={() => sendGif(gifUrlInput)} className="text-primary">
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setGifTargetOpen(false)} className="text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Add-to-queue bar (Queue tab) / Chat Input Bar (Chat tab) */}
          <div className="p-3 border-t border-border bg-card/50">
            {sidebarTab === 'queue' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={youtubeUrlInput}
                  onChange={(e) => setYoutubeUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitAddToQueue()}
                  placeholder="Paste a YouTube link to queue..."
                  className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => submitAddToQueue()}
                  className="p-2.5 rounded-xl bg-primary hover:bg-primary-hover text-foreground shadow transition-all"
                  title="Add to queue"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGifTargetOpen(!gifTargetOpen)}
                  className="p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground border border-foreground/10 transition-colors flex-shrink-0"
                  title="Send a GIF"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Send reaction or comment..."
                  className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleSendMessage}
                  className="p-2.5 rounded-xl bg-primary hover:bg-primary-hover text-foreground shadow transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Buddy Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">Invite Friend to Watch</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No accepted contacts found. Add contacts first!</p>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-foreground/5 border border-foreground/5"
                  >
                    <div className="flex items-center gap-3">
                      <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                      <span className="text-xs font-semibold text-foreground">{c.displayName}</span>
                    </div>
                    <button
                      onClick={() => sendBuddyInvite(c.id)}
                      className="px-3 py-1.5 bg-primary text-foreground text-xs font-semibold rounded-lg glow-button"
                    >
                      Send Invite
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full py-2 bg-foreground/10 hover:bg-foreground/20 text-xs font-semibold text-foreground rounded-xl"
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
            <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              File Safety Report
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Reports are confidentially submitted directly to Super Admin moderators.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Participant</label>
                <select
                  value={reportTargetId}
                  onChange={(e) => setReportTargetId(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-2 text-xs text-foreground"
                >
                  <option className="bg-card text-foreground" value="">Select participant...</option>
                  {participants
                    .filter((p) => p.userId !== currentUser.id)
                    .map((p) => (
                      <option key={p.userId} className="bg-card text-foreground" value={p.userId}>
                        {p.user?.displayName || p.userId}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-2 text-xs text-foreground"
                >
                  <option className="bg-card text-foreground" value="HARASSMENT">Harassment or Hate Speech</option>
                  <option className="bg-card text-foreground" value="INAPPROPRIATE_CONTENT">Inappropriate Content</option>
                  <option className="bg-card text-foreground" value="SPAM">Spam or Abuse</option>
                  <option className="bg-card text-foreground" value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Details</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-2 text-xs text-foreground h-20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2 bg-foreground/10 hover:bg-foreground/20 text-xs font-semibold text-foreground rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-bold text-foreground rounded-xl shadow"
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
            <h3 className="text-lg font-bold text-foreground">Rate Watch Experience</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">How was your session with your watch buddies?</p>

            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="p-1 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= reviewRating ? 'fill-amber-400 text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Add optional comment..."
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-2.5 text-xs text-foreground h-16 mb-4"
            />

            <button
              onClick={submitReview}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-foreground text-xs font-bold rounded-xl glow-button"
            >
              Done & Return Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
