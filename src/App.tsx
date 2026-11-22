import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CreateRoomModal } from './components/CreateRoomModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { MeetingLobby } from './components/MeetingLobby';
import { MeetingStage } from './components/MeetingStage';
import { useWebRTC } from './hooks/useWebRTC';
import type {
  ChatMessage,
  FloatingReaction,
  MessageReaction,
  MessageReplyRef,
  RoomMember,
  RoomStatePayload,
  RoomSummary,
  RoomVisibility,
  ServerEventEntry,
  TypingPayload,
} from './types/chat';

const USER_COLORS = [
  '#2563EB',
  '#0D9488',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#059669',
  '#4F46E5',
  '#EA580C',
];

function getInitialIdentity(): { username: string; color: string } {
  const savedName = localStorage.getItem('relay_username');
  const savedColor = localStorage.getItem('relay_color');
  const username =
    savedName && savedName.trim()
      ? savedName.trim()
      : `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
  const color =
    savedColor && USER_COLORS.includes(savedColor)
      ? savedColor
      : USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

  localStorage.setItem('relay_username', username);
  localStorage.setItem('relay_color', color);
  return { username, color };
}

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('relay_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

function getInitialRoomFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room')?.trim();
  return room || null;
}

function extractRoomCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('://') || trimmed.includes('?room=')) {
      const url = new URL(
        trimmed.startsWith('http') ? trimmed : `https://example.com/${trimmed}`
      );
      const param = url.searchParams.get('room');
      if (param) return param.trim();
    }
  } catch {
    // Fallback to raw text
  }
  return trimmed;
}

export default function App() {
  const initialIdentity = useMemo(() => getInitialIdentity(), []);
  const [username, setUsername] = useState(initialIdentity.username);
  const [userColor, setUserColor] = useState(initialIdentity.color);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());

  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('reconnecting');
  const [socketId, setSocketId] = useState('');
  const [activeUserCount, setActiveUserCount] = useState(1);

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    getInitialRoomFromUrl()
  );
  const [inMeeting, setInMeeting] = useState<boolean>(false);
  const [handRaised, setHandRaised] = useState(false);

  const [messagesByRoom, setMessagesByRoom] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [membersByRoom, setMembersByRoom] = useState<
    Record<string, RoomMember[]>
  >({});
  const [typingByRoom, setTypingByRoom] = useState<
    Record<string, TypingPayload[]>
  >({});
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>(
    []
  );

  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [events, setEvents] = useState<ServerEventEntry[]>([]);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalState, setJoinModalState] = useState<{
    open: boolean;
    roomCode: string;
    requiresPasscode: boolean;
    error: string;
  }>({
    open: false,
    roomCode: '',
    requiresPasscode: false,
    error: '',
  });

  const socketRef = useRef<Socket | null>(null);
  const activeRoomRef = useRef<string | null>(activeRoomId);
  const inMeetingRef = useRef(inMeeting);
  const usernameRef = useRef(username);
  const userColorRef = useRef(userColor);
  const audioEnabledRef = useRef(false);
  const videoEnabledRef = useRef(false);

  const activeMembers = useMemo(
    () => (activeRoomId ? membersByRoom[activeRoomId] ?? [] : []),
    [activeRoomId, membersByRoom]
  );

  const webrtc = useWebRTC({
    socket: socketInstance,
    socketId,
    activeRoomId,
    members: activeMembers,
    inMeeting,
  });

  useEffect(() => {
    audioEnabledRef.current = webrtc.audioEnabled;
    videoEnabledRef.current = webrtc.videoEnabled;
  }, [webrtc.audioEnabled, webrtc.videoEnabled]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('relay_theme', theme);
  }, [theme]);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
    inMeetingRef.current = inMeeting;
    const targetUrl =
      inMeeting && activeRoomId
        ? `/?room=${encodeURIComponent(activeRoomId)}`
        : '/';
    window.history.replaceState({}, '', targetUrl);
  }, [activeRoomId, inMeeting]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    userColorRef.current = userColor;
  }, [userColor]);

  const logEvent = useCallback(
    (event: string, direction: 'incoming' | 'outgoing', payload: unknown) => {
      const text =
        typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
      const entry: ServerEventEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        event,
        direction,
        payload: text,
        timestamp: Date.now(),
      };
      setEvents((prev) => [entry, ...prev].slice(0, 60));
    },
    []
  );

  const joinMeetingRoom = useCallback(
    (
      roomId: string,
      passcode?: string
    ): Promise<{
      ok: boolean;
      error?: string;
      requiresPasscode?: boolean;
    }> => {
      return new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: 'Not connected to server yet.' });
          return;
        }
        logEvent('room:join', 'outgoing', {
          roomId,
          hasPasscode: Boolean(passcode),
        });
        socket.emit(
          'room:join',
          {
            roomId,
            passcode,
            media: {
              audioEnabled: audioEnabledRef.current,
              videoEnabled: videoEnabledRef.current,
            },
          },
          (res: {
            ok: boolean;
            error?: string;
            requiresPasscode?: boolean;
          }) => {
            if (res.ok) {
              setActiveRoomId(roomId);
              setInMeeting(true);
              setHandRaised(false);
              setUnreadChatCount(0);
            }
            resolve(res);
          }
        );
      });
    },
    [logEvent]
  );

  useEffect(() => {
    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;
    setSocketInstance(socket);

    const urlRoom = getInitialRoomFromUrl();

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setSocketId(socket.id ?? '');

      socket.emit('user:identify', {
        username: usernameRef.current,
        color: userColorRef.current,
      });

      const targetRoom =
        inMeetingRef.current && activeRoomRef.current
          ? activeRoomRef.current
          : urlRoom;

      if (targetRoom) {
        socket.emit(
          'room:join',
          {
            roomId: targetRoom,
            media: {
              audioEnabled: audioEnabledRef.current,
              videoEnabled: videoEnabledRef.current,
            },
          },
          (res: {
            ok: boolean;
            error?: string;
            requiresPasscode?: boolean;
          }) => {
            if (res.ok) {
              setActiveRoomId(targetRoom);
              setInMeeting(true);
            } else {
              setActiveRoomId(null);
              setInMeeting(false);
              setJoinModalState({
                open: true,
                roomCode: targetRoom,
                requiresPasscode: Boolean(res.requiresPasscode),
                error: res.error || 'Could not join invited meeting.',
              });
            }
          }
        );
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      logEvent('disconnect', 'incoming', 'Disconnected from server');
    });

    socket.io.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    // Original backend events preserved verbatim
    socket.on('click', (msg: string) => {
      logEvent('click', 'incoming', msg);
    });

    socket.on('join', (msg: string) => {
      logEvent('join', 'incoming', msg);
    });

    socket.on('announcement', (msg: string) => {
      logEvent('announcement', 'incoming', msg);
      setAnnouncement(msg);
    });

    socket.on('active:count', (count: number) => {
      setActiveUserCount(count);
      logEvent('active:count', 'incoming', `Active users: ${count}`);
    });

    socket.on('rooms:sync', (roomList: RoomSummary[]) => {
      setRooms(roomList);
    });

    socket.on('room:state', (payload: RoomStatePayload) => {
      setMessagesByRoom((prev) => ({
        ...prev,
        [payload.room.id]: payload.messages,
      }));
      setMembersByRoom((prev) => ({
        ...prev,
        [payload.room.id]: payload.members,
      }));
    });

    socket.on(
      'room:members',
      (payload: { roomId: string; members: RoomMember[] }) => {
        setMembersByRoom((prev) => ({
          ...prev,
          [payload.roomId]: payload.members,
        }));
      }
    );

    socket.on('room:message', (msg: ChatMessage) => {
      setMessagesByRoom((prev) => {
        const existing = prev[msg.roomId] ?? [];
        if (existing.some((item) => item.id === msg.id)) {
          return prev;
        }
        return {
          ...prev,
          [msg.roomId]: [...existing, msg],
        };
      });

      if (msg.roomId === activeRoomRef.current && msg.kind !== 'system') {
        setUnreadChatCount((c) => c + 1);
      }

      if (msg.kind === 'fr') {
        logEvent('fr', 'incoming', `${msg.senderName}: ${msg.text}`);
      } else if (msg.kind === 'user') {
        logEvent(
          'room:message',
          'incoming',
          `[${msg.roomId}] ${msg.senderName}: ${msg.text}`
        );
      }
    });

    socket.on(
      'room:reaction',
      (payload: {
        roomId: string;
        messageId: string;
        reactions: MessageReaction[];
      }) => {
        setMessagesByRoom((prev) => {
          const list = prev[payload.roomId];
          if (!list) return prev;
          return {
            ...prev,
            [payload.roomId]: list.map((msg) =>
              msg.id === payload.messageId
                ? { ...msg, reactions: payload.reactions }
                : msg
            ),
          };
        });
      }
    );

    socket.on('room:typing', (payload: TypingPayload) => {
      setTypingByRoom((prev) => {
        const list = prev[payload.roomId] ?? [];
        const filtered = list.filter((t) => t.socketId !== payload.socketId);
        return {
          ...prev,
          [payload.roomId]: payload.isTyping ? [...filtered, payload] : filtered,
        };
      });
    });

    socket.on('meeting:reaction', (reaction: FloatingReaction) => {
      if (reaction.roomId !== activeRoomRef.current) return;
      setFloatingReactions((prev) => [...prev, reaction].slice(-5));
      window.setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3200);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [logEvent]);

  const handleCreateMeeting = async (data: {
    name: string;
    topic: string;
    visibility: RoomVisibility;
    passcode: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        resolve({
          ok: false,
          error: 'Wait for server connection before starting a meeting.',
        });
        return;
      }

      logEvent('room:create', 'outgoing', {
        name: data.name,
        visibility: data.visibility,
      });

      socket.emit(
        'room:create',
        {
          ...data,
          media: {
            audioEnabled: webrtc.audioEnabled,
            videoEnabled: webrtc.videoEnabled,
          },
        },
        (res: { ok: boolean; room?: RoomSummary; error?: string }) => {
          if (res.ok && res.room) {
            setActiveRoomId(res.room.id);
            setInMeeting(true);
            setHandRaised(false);
            setUnreadChatCount(0);
          }
          resolve({ ok: res.ok, error: res.error });
        }
      );
    });
  };

  const handleInstantMeeting = () => {
    void handleCreateMeeting({
      name: `${username}'s Meeting`,
      topic: 'Instant personal meeting — invite anyone with the room link.',
      visibility: 'private',
      passcode: '',
    });
  };

  const handleJoinByCode = async (raw: string) => {
    const roomId = extractRoomCode(raw);
    if (!roomId) return;
    const res = await joinMeetingRoom(roomId);
    if (!res.ok) {
      setJoinModalState({
        open: true,
        roomCode: roomId,
        requiresPasscode: Boolean(res.requiresPasscode),
        error: res.error || 'Could not join meeting.',
      });
    }
  };

  const handleJoinPublicRoom = async (roomId: string) => {
    const res = await joinMeetingRoom(roomId);
    if (!res.ok) {
      setJoinModalState({
        open: true,
        roomCode: roomId,
        requiresPasscode: Boolean(res.requiresPasscode),
        error: res.error || 'Could not join meeting.',
      });
    }
  };

  const handleLeaveMeeting = () => {
    const socket = socketRef.current;
    const currentRoom = activeRoomId;
    if (webrtc.screenSharing) {
      void webrtc.stopScreenShare();
    }
    webrtc.closeAllPeers();
    if (socket && currentRoom) {
      logEvent('room:leave', 'outgoing', { roomId: currentRoom });
      socket.emit('room:leave', { roomId: currentRoom });
    }
    setInMeeting(false);
    setActiveRoomId(null);
    setHandRaised(false);
    setFloatingReactions([]);
  };

  const handleToggleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    if (socketRef.current && activeRoomId && inMeeting) {
      socketRef.current.emit('media:state', {
        roomId: activeRoomId,
        handRaised: next,
      });
    }
  };

  const handleSendMeetingReaction = (emoji: string) => {
    if (!socketRef.current || !activeRoomId) return;
    socketRef.current.emit('meeting:reaction', {
      roomId: activeRoomId,
      emoji,
    });
  };

  const handleSendMessage = (text: string, replyTo?: MessageReplyRef) => {
    if (!socketRef.current || !activeRoomId) return;
    socketRef.current.emit('room:message', {
      roomId: activeRoomId,
      text,
      replyTo,
    });
  };

  const handleReactMessage = (messageId: string, emoji: string) => {
    if (!socketRef.current || !activeRoomId) return;
    socketRef.current.emit('room:react', {
      roomId: activeRoomId,
      messageId,
      emoji,
    });
  };

  const handleTypingChange = (isTyping: boolean) => {
    if (!socketRef.current || !activeRoomId) return;
    socketRef.current.emit('room:typing', {
      roomId: activeRoomId,
      isTyping,
    });
  };

  const handleUpdateProfile = (nextName: string, nextColor: string) => {
    setUsername(nextName);
    setUserColor(nextColor);
    localStorage.setItem('relay_username', nextName);
    localStorage.setItem('relay_color', nextColor);
    socketRef.current?.emit('user:identify', {
      username: nextName,
      color: nextColor,
    });
  };

  const handleEmitFr = (payload: string) => {
    if (!socketRef.current) return;
    logEvent('fr', 'outgoing', payload);
    socketRef.current.emit('fr', payload);
  };

  const handleSendAnnouncement = (text: string) => {
    if (!socketRef.current) return;
    logEvent('announcement:send', 'outgoing', text);
    socketRef.current.emit('announcement:send', { text });
  };

  const clearUnreadChat = useCallback(() => {
    setUnreadChatCount(0);
  }, []);

  const activeRoom = activeRoomId
    ? rooms.find((r) => r.id === activeRoomId)
    : undefined;
  const activeMessages = useMemo(
    () => (activeRoomId ? messagesByRoom[activeRoomId] ?? [] : []),
    [activeRoomId, messagesByRoom]
  );
  const activeTypers = useMemo(
    () => (activeRoomId ? typingByRoom[activeRoomId] ?? [] : []),
    [activeRoomId, typingByRoom]
  );

  return (
    <>
      {inMeeting && activeRoomId ? (
        <MeetingStage
          room={activeRoom}
          roomId={activeRoomId}
          members={activeMembers}
          currentSocketId={socketId}
          localStream={webrtc.localStream}
          screenStream={webrtc.screenStream}
          remoteStreams={webrtc.remoteStreams}
          audioEnabled={webrtc.audioEnabled}
          videoEnabled={webrtc.videoEnabled}
          screenSharing={webrtc.screenSharing}
          handRaised={handRaised}
          mediaError={webrtc.mediaError}
          messages={activeMessages}
          typingUsers={activeTypers}
          unreadChatCount={unreadChatCount}
          announcement={announcement}
          events={events}
          floatingReactions={floatingReactions}
          onToggleAudio={() => void webrtc.toggleAudio()}
          onToggleVideo={() => void webrtc.toggleVideo()}
          onToggleScreenShare={() => void webrtc.toggleScreenShare()}
          onToggleHandRaise={handleToggleHandRaise}
          onSendMeetingReaction={handleSendMeetingReaction}
          onLeaveMeeting={handleLeaveMeeting}
          onSendMessage={handleSendMessage}
          onReactMessage={handleReactMessage}
          onTypingChange={handleTypingChange}
          onEmitFr={handleEmitFr}
          onSendAnnouncement={handleSendAnnouncement}
          onDismissAnnouncement={() => setAnnouncement(null)}
          onDismissMediaError={() => webrtc.setMediaError(null)}
          onClearUnreadChat={clearUnreadChat}
        />
      ) : (
        <MeetingLobby
          username={username}
          userColor={userColor}
          colorChoices={USER_COLORS}
          theme={theme}
          connectionStatus={connectionStatus}
          activeUserCount={activeUserCount}
          rooms={rooms}
          announcement={announcement}
          localStream={webrtc.localStream}
          audioEnabled={webrtc.audioEnabled}
          videoEnabled={webrtc.videoEnabled}
          mediaError={webrtc.mediaError}
          onToggleAudio={() => void webrtc.toggleAudio()}
          onToggleVideo={() => void webrtc.toggleVideo()}
          onDismissAnnouncement={() => setAnnouncement(null)}
          onDismissMediaError={() => webrtc.setMediaError(null)}
          onToggleTheme={() =>
            setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
          }
          onUpdateProfile={handleUpdateProfile}
          onOpenCreateMeeting={() => setCreateModalOpen(true)}
          onInstantMeeting={handleInstantMeeting}
          onJoinByCode={(code) => void handleJoinByCode(code)}
          onJoinRoom={(id) => void handleJoinPublicRoom(id)}
        />
      )}

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateMeeting}
      />

      <JoinRoomModal
        isOpen={joinModalState.open}
        initialRoomCode={joinModalState.roomCode}
        initialRequiresPasscode={joinModalState.requiresPasscode}
        initialError={joinModalState.error}
        onClose={() =>
          setJoinModalState({
            open: false,
            roomCode: '',
            requiresPasscode: false,
            error: '',
          })
        }
        onJoin={joinMeetingRoom}
      />
    </>
  );
}
