import { NextResponse } from 'next/server';

// Public (no auth needed - WebRTC clients need these to negotiate ICE at
// all, so there's nothing meaningful to hide here). STUN alone only helps
// simple NAT traversal; without a TURN relay as fallback, two people behind
// restrictive/symmetric NATs or a corporate firewall can complete signaling
// perfectly (offer/answer/ICE candidates all relay fine over Socket.IO) and
// still never actually connect - which is exactly the "only see myself"
// symptom this fixes. Falls back to STUN-only if no TURN provider is
// configured, so existing behavior doesn't regress with zero setup.
export const dynamic = 'force-dynamic';

export async function GET() {
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map((u) => u.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return NextResponse.json({ iceServers });
}
