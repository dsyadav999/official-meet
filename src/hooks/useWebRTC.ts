import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomMember } from '../types/chat';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

interface UseWebRTCOptions {
  socket: Socket | null;
  socketId: string;
  activeRoomId: string | null;
  members: RoomMember[];
  inMeeting: boolean;
}

export function useWebRTC({
  socket,
  socketId,
  activeRoomId,
  members,
  inMeeting,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const emitMediaState = useCallback(
    (next: Partial<{ audioEnabled: boolean; videoEnabled: boolean; screenSharing: boolean }>) => {
      if (!socket || !activeRoomId || !inMeeting) return;
      socket.emit('media:state', {
        roomId: activeRoomId,
        ...next,
      });
    },
    [socket, activeRoomId, inMeeting]
  );

  const getActiveOutboundTracks = useCallback((): MediaStreamTrack[] => {
    const tracks: MediaStreamTrack[] = [];
    const camStream = localStreamRef.current;
    const scrStream = screenStreamRef.current;

    if (camStream) {
      for (const t of camStream.getAudioTracks()) {
        tracks.push(t);
      }
    }
    if (scrStream && scrStream.getVideoTracks().length > 0) {
      tracks.push(scrStream.getVideoTracks()[0]);
    } else if (camStream) {
      for (const t of camStream.getVideoTracks()) {
        tracks.push(t);
      }
    }
    return tracks;
  }, []);

  const syncTracksToPeer = useCallback(
    async (pc: RTCPeerConnection, targetSocketId: string, renegotiate: boolean) => {
      const outbound = getActiveOutboundTracks();
      const senders = pc.getSenders();
      let changed = false;

      // Replace or remove existing senders
      for (const sender of senders) {
        if (!sender.track) continue;
        const match = outbound.find((t) => t.kind === sender.track?.kind);
        if (match) {
          if (sender.track !== match) {
            await sender.replaceTrack(match);
          }
        }
      }

      // Add any missing kinds
      for (const track of outbound) {
        const hasKind = pc
          .getSenders()
          .some((s) => s.track && s.track.kind === track.kind);
        if (!hasKind) {
          const stream =
            screenStreamRef.current?.getTracks().includes(track)
              ? screenStreamRef.current!
              : localStreamRef.current!;
          pc.addTrack(track, stream);
          changed = true;
        }
      }

      if (renegotiate && changed && socket && activeRoomId) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {
            roomId: activeRoomId,
            targetSocketId,
            sdp: pc.localDescription,
          });
        } catch {
          // Ignore transient negotiation race
        }
      }
    },
    [getActiveOutboundTracks, socket, activeRoomId]
  );

  const syncTracksToAllPeers = useCallback(
    async (renegotiate: boolean) => {
      for (const [peerId, pc] of peersRef.current.entries()) {
        await syncTracksToPeer(pc, peerId, renegotiate);
      }
    },
    [syncTracksToPeer]
  );

  const createPeerConnection = useCallback(
    (peerSocketId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peerSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerSocketId, pc);

      // Attach current outbound tracks immediately
      const outbound = getActiveOutboundTracks();
      for (const track of outbound) {
        const ownerStream =
          screenStreamRef.current?.getTracks().includes(track)
            ? screenStreamRef.current!
            : localStreamRef.current!;
        pc.addTrack(track, ownerStream);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && activeRoomId) {
          socket.emit('webrtc:ice', {
            roomId: activeRoomId,
            targetSocketId: peerSocketId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteStreams((prev) => ({
          ...prev,
          [peerSocketId]: stream,
        }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peersRef.current.delete(peerSocketId);
        }
      };

      return pc;
    },
    [getActiveOutboundTracks, socket, activeRoomId]
  );

  const closeAllPeers = useCallback(() => {
    for (const pc of peersRef.current.values()) {
      pc.close();
    }
    peersRef.current.clear();
    pendingIceRef.current.clear();
    setRemoteStreams((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, []);

  // Ensure local stream has requested audio/video hardware tracks
  const ensureMedia = useCallback(
    async (wantAudio: boolean, wantVideo: boolean) => {
      setMediaError(null);
      try {
        const current = localStreamRef.current;
        const hasAudio = Boolean(current?.getAudioTracks().length);
        const hasVideo = Boolean(current?.getVideoTracks().length);

        const needAudio = wantAudio && !hasAudio;
        const needVideo = wantVideo && !hasVideo;

        if (!needAudio && !needVideo) {
          if (current) {
            current.getAudioTracks().forEach((t) => (t.enabled = wantAudio));
            current.getVideoTracks().forEach((t) => (t.enabled = wantVideo));
          }
          setAudioEnabled(wantAudio);
          setVideoEnabled(wantVideo);
          emitMediaState({ audioEnabled: wantAudio, videoEnabled: wantVideo });
          return true;
        }

        const acquired = await navigator.mediaDevices.getUserMedia({
          audio: needAudio,
          video: needVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });

        const combined = new MediaStream();
        if (current) {
          current.getTracks().forEach((t) => combined.addTrack(t));
        }
        acquired.getTracks().forEach((t) => combined.addTrack(t));

        combined.getAudioTracks().forEach((t) => (t.enabled = wantAudio));
        combined.getVideoTracks().forEach((t) => (t.enabled = wantVideo));

        localStreamRef.current = combined;
        setLocalStream(combined);
        setAudioEnabled(wantAudio);
        setVideoEnabled(wantVideo);
        emitMediaState({ audioEnabled: wantAudio, videoEnabled: wantVideo });
        await syncTracksToAllPeers(true);
        return true;
      } catch (err) {
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Camera or microphone permission was denied. Allow access in your browser settings.'
            : 'No camera or microphone detected. You can still join with chat and screen share.';
        setMediaError(message);
        return false;
      }
    },
    [emitMediaState, syncTracksToAllPeers]
  );

  const toggleAudio = useCallback(async () => {
    const next = !audioEnabled;
    if (next) {
      await ensureMedia(true, videoEnabled);
    } else {
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
      setAudioEnabled(false);
      emitMediaState({ audioEnabled: false });
    }
  }, [audioEnabled, videoEnabled, ensureMedia, emitMediaState]);

  const toggleVideo = useCallback(async () => {
    const next = !videoEnabled;
    if (next) {
      await ensureMedia(audioEnabled, true);
    } else {
      localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
      setVideoEnabled(false);
      emitMediaState({ videoEnabled: false });
    }
  }, [audioEnabled, videoEnabled, ensureMedia, emitMediaState]);

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setScreenSharing(false);
    emitMediaState({ screenSharing: false });
    await syncTracksToAllPeers(true);
  }, [emitMediaState, syncTracksToAllPeers]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      await stopScreenShare();
      return;
    }
    setMediaError(null);
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const videoTrack = display.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          void stopScreenShare();
        };
      }
      screenStreamRef.current = display;
      setScreenStream(display);
      setScreenSharing(true);
      emitMediaState({ screenSharing: true });
      await syncTracksToAllPeers(true);
    } catch {
      // User cancelled screen picker
    }
  }, [screenSharing, stopScreenShare, emitMediaState, syncTracksToAllPeers]);

  const stopAllMedia = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setScreenStream(null);
    setLocalStream(null);
    setAudioEnabled(false);
    setVideoEnabled(false);
    setScreenSharing(false);
    closeAllPeers();
  }, [closeAllPeers]);

  // Handle WebRTC signaling events from Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async (payload: {
      roomId?: string;
      fromSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (!inMeeting || payload.roomId !== activeRoomId) return;
      const pc = createPeerConnection(payload.fromSocketId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const pending = pendingIceRef.current.get(payload.fromSocketId) ?? [];
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceRef.current.delete(payload.fromSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          roomId: activeRoomId,
          targetSocketId: payload.fromSocketId,
          sdp: pc.localDescription,
        });
      } catch {
        // Ignore stale offer
      }
    };

    const handleAnswer = async (payload: {
      roomId?: string;
      fromSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (!inMeeting || payload.roomId !== activeRoomId) return;
      const pc = peersRef.current.get(payload.fromSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const pending = pendingIceRef.current.get(payload.fromSocketId) ?? [];
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceRef.current.delete(payload.fromSocketId);
      } catch {
        // Ignore stale answer
      }
    };

    const handleIce = async (payload: {
      roomId?: string;
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!inMeeting || payload.roomId !== activeRoomId) return;
      const pc = peersRef.current.get(payload.fromSocketId);
      if (!pc || !pc.remoteDescription) {
        const queue = pendingIceRef.current.get(payload.fromSocketId) ?? [];
        queue.push(payload.candidate);
        pendingIceRef.current.set(payload.fromSocketId, queue);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore invalid candidate
      }
    };

    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice', handleIce);

    return () => {
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice', handleIce);
    };
  }, [socket, inMeeting, activeRoomId, createPeerConnection]);

  // Initiate peer connections deterministically when meeting members change
  useEffect(() => {
    if (!inMeeting || !socket || !socketId || !activeRoomId) {
      if (peersRef.current.size > 0 || pendingIceRef.current.size > 0) {
        closeAllPeers();
      }
      return;
    }

    const activeIds = new Set(members.map((m) => m.socketId));

    // Close peers that left
    for (const [peerId, pc] of peersRef.current.entries()) {
      if (!activeIds.has(peerId)) {
        pc.close();
        peersRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
      }
    }

    // Deterministically initiate offers to peers with greater socketId
    for (const member of members) {
      if (member.socketId === socketId) continue;
      if (peersRef.current.has(member.socketId)) continue;

      if (socketId.localeCompare(member.socketId) < 0) {
        const pc = createPeerConnection(member.socketId);
        void (async () => {
          try {
            // Ensure at least recvonly transceivers so connection establishes even with cam/mic off
            if (pc.getTransceivers().length === 0) {
              pc.addTransceiver('audio', { direction: 'sendrecv' });
              pc.addTransceiver('video', { direction: 'sendrecv' });
            }
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', {
              roomId: activeRoomId,
              targetSocketId: member.socketId,
              sdp: pc.localDescription,
            });
          } catch {
            // Ignore transient error
          }
        })();
      }
    }
  }, [inMeeting, socket, socketId, activeRoomId, members, createPeerConnection, closeAllPeers]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    screenSharing,
    mediaError,
    setMediaError,
    ensureMedia,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    stopScreenShare,
    stopAllMedia,
    closeAllPeers,
  };
}
