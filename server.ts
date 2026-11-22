import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import type {
  ChatMessage,
  RoomMember,
  RoomSummary,
  RoomVisibility,
} from './src/types/chat.ts';

interface InternalRoom {
  id: string;
  name: string;
  topic: string;
  visibility: RoomVisibility;
  passcode: string | null;
  createdBy: string;
  creatorSocketId: string;
  createdAt: number;
  isDefault: boolean;
  members: Map<string, RoomMember>;
  messages: ChatMessage[];
}

interface UserProfile {
  username: string;
  color: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_MESSAGES_PER_ROOM = 150;

const AVATAR_COLORS = [
  '#2563EB',
  '#0D9488',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#059669',
  '#4F46E5',
  '#EA580C',
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function slugifyRoomId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  const suffix = crypto.randomBytes(2).toString('hex');
  return base ? `${base}-${suffix}` : `room-${suffix}`;
}

function toRoomSummary(room: InternalRoom): RoomSummary {
  return {
    id: room.id,
    name: room.name,
    topic: room.topic,
    visibility: room.visibility,
    hasPasscode: Boolean(room.passcode),
    createdBy: room.createdBy,
    creatorSocketId: room.creatorSocketId,
    createdAt: room.createdAt,
    memberCount: room.members.size,
    isDefault: room.isDefault,
  };
}

function appendMessage(room: InternalRoom, message: ChatMessage): void {
  room.messages.push(message);
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES_PER_ROOM);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpserver = http.createServer(app);
  const io = new Server(httpserver, {
    cors: {
      origin: '*',
    },
  });

  const rooms = new Map<string, InternalRoom>();
  const profiles = new Map<string, UserProfile>();

  const seedRooms: Array<{
    id: string;
    name: string;
    topic: string;
    visibility: RoomVisibility;
  }> = [
    {
      id: 'general',
      name: 'General Meeting',
      topic: 'Open drop-in video and chat room for everyone online.',
      visibility: 'public',
    },
    {
      id: 'announcements',
      name: 'Class & Study Hall',
      topic: 'Live lectures, announcements, and group Q&A.',
      visibility: 'public',
    },
  ];

  for (const seed of seedRooms) {
    rooms.set(seed.id, {
      id: seed.id,
      name: seed.name,
      topic: seed.topic,
      visibility: seed.visibility,
      passcode: null,
      createdBy: 'System',
      creatorSocketId: 'system',
      createdAt: Date.now(),
      isDefault: true,
      members: new Map(),
      messages: [
        {
          id: `seed-${seed.id}`,
          roomId: seed.id,
          senderId: 'system',
          senderName: 'System',
          senderColor: '#475569',
          text: `Welcome to ${seed.name}. Invite others or create a personal room from the sidebar.`,
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    });
  }

  function getPublicRooms(): RoomSummary[] {
    const list: RoomSummary[] = [];
    for (const room of rooms.values()) {
      if (room.visibility === 'public') {
        list.push(toRoomSummary(room));
      }
    }
    return list;
  }

  function getRoomsForSocket(socketId: string): RoomSummary[] {
    const list: RoomSummary[] = [];
    for (const room of rooms.values()) {
      if (
        room.visibility === 'public' ||
        room.members.has(socketId) ||
        room.creatorSocketId === socketId
      ) {
        list.push(toRoomSummary(room));
      }
    }
    return list;
  }

  function syncRoomsToAll() {
    for (const [sid] of io.sockets.sockets) {
      io.to(sid).emit('rooms:sync', getRoomsForSocket(sid));
    }
  }

  function joinSocketToRoom(
    socketId: string,
    room: InternalRoom,
    initialMedia?: Partial<{
      audioEnabled: boolean;
      videoEnabled: boolean;
      screenSharing: boolean;
      handRaised: boolean;
    }>
  ) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;

    const profile = profiles.get(socketId) ?? {
      username: `Guest-${socketId.slice(0, 4)}`,
      color: pickColor(socketId),
    };

    const alreadyMember = room.members.has(socketId);
    socket.join(room.id);

    if (!alreadyMember) {
      const member: RoomMember = {
        socketId,
        username: profile.username,
        color: profile.color,
        joinedAt: Date.now(),
        audioEnabled: Boolean(initialMedia?.audioEnabled),
        videoEnabled: Boolean(initialMedia?.videoEnabled),
        screenSharing: Boolean(initialMedia?.screenSharing),
        handRaised: Boolean(initialMedia?.handRaised),
      };
      room.members.set(socketId, member);

      const joinMsg: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: room.id,
        senderId: 'system',
        senderName: 'System',
        senderColor: '#475569',
        text: `${profile.username} joined the meeting`,
        timestamp: Date.now(),
        kind: 'system',
      };
      appendMessage(room, joinMsg);
      io.to(room.id).emit('room:message', joinMsg);
    } else if (initialMedia) {
      const existing = room.members.get(socketId)!;
      existing.audioEnabled = initialMedia.audioEnabled ?? existing.audioEnabled;
      existing.videoEnabled = initialMedia.videoEnabled ?? existing.videoEnabled;
      existing.screenSharing = initialMedia.screenSharing ?? existing.screenSharing;
      existing.handRaised = initialMedia.handRaised ?? existing.handRaised;
    }

    const members = Array.from(room.members.values());
    io.to(room.id).emit('room:members', { roomId: room.id, members });
    socket.emit('room:state', {
      room: toRoomSummary(room),
      members,
      messages: room.messages,
    });

    syncRoomsToAll();
  }

  // REST helper for checking a room invite code before joining
  app.get('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      res.status(404).json({ ok: false, error: 'Room not found' });
      return;
    }
    res.json({ ok: true, room: toRoomSummary(room) });
  });

  // Preserve original active user counter & Socket.IO events
  let count = 0;

  io.on('connection', (socket) => {
    count++;
    console.log('Active user: ', count);

    const defaultProfile: UserProfile = {
      username: `Guest-${socket.id.slice(0, 4)}`,
      color: pickColor(socket.id),
    };
    profiles.set(socket.id, defaultProfile);

    // Send msg from server to client (original backend event preserved)
    socket.emit('click', 'Hello from socket.IO');

    // Send msg from server to client (original backend event preserved)
    socket.broadcast.emit('join', 'New User Joined');

    // Original global announcement event preserved
    io.emit('announcement', 'Today is last class');

    // Broadcast authoritative active count to clients
    io.emit('active:count', count);

    // Send initial public/accessible rooms list
    socket.emit('rooms:sync', getRoomsForSocket(socket.id));

    // Original "fr" listener preserved + bridged into live chat stream
    socket.on('fr', (cb: unknown) => {
      console.log(cb);
      const text = typeof cb === 'string' ? cb.trim() : JSON.stringify(cb ?? '');
      if (!text) return;

      const profile = profiles.get(socket.id) ?? defaultProfile;
      // Deliver to all rooms the socket is currently in, or fallback to general
      const targetRooms: InternalRoom[] = [];
      for (const room of rooms.values()) {
        if (room.members.has(socket.id)) {
          targetRooms.push(room);
        }
      }
      if (targetRooms.length === 0) {
        const general = rooms.get('general');
        if (general) targetRooms.push(general);
      }

      for (const room of targetRooms) {
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          roomId: room.id,
          senderId: socket.id,
          senderName: profile.username,
          senderColor: profile.color,
          text,
          timestamp: Date.now(),
          kind: 'fr',
        };
        appendMessage(room, msg);
        io.to(room.id).emit('room:message', msg);
      }
    });

    socket.on(
      'user:identify',
      (
        payload: { username?: string; color?: string },
        ack?: (res: { ok: boolean; profile: UserProfile }) => void
      ) => {
        const rawName = (payload?.username ?? '').trim().slice(0, 28);
        const existing = profiles.get(socket.id) ?? defaultProfile;
        const nextProfile: UserProfile = {
          username: rawName || existing.username,
          color: payload?.color || existing.color,
        };
        profiles.set(socket.id, nextProfile);

        for (const room of rooms.values()) {
          const member = room.members.get(socket.id);
          if (member) {
            member.username = nextProfile.username;
            member.color = nextProfile.color;
            io.to(room.id).emit('room:members', {
              roomId: room.id,
              members: Array.from(room.members.values()),
            });
          }
        }

        ack?.({ ok: true, profile: nextProfile });
      }
    );

    socket.on(
      'room:create',
      (
        payload: {
          name?: string;
          topic?: string;
          visibility?: RoomVisibility;
          passcode?: string;
          media?: { audioEnabled?: boolean; videoEnabled?: boolean };
        },
        ack?: (res: { ok: boolean; room?: RoomSummary; error?: string }) => void
      ) => {
        const name = (payload?.name ?? '').trim().slice(0, 40);
        if (!name) {
          ack?.({ ok: false, error: 'Meeting name is required.' });
          return;
        }

        const visibility: RoomVisibility =
          payload?.visibility === 'private' ? 'private' : 'public';
        const passcode = (payload?.passcode ?? '').trim().slice(0, 32) || null;
        const topic =
          (payload?.topic ?? '').trim().slice(0, 120) ||
          (visibility === 'private'
            ? 'Personal meeting room — share the room code or invite link.'
            : 'Open meeting room.');

        let roomId = slugifyRoomId(name);
        while (rooms.has(roomId)) {
          roomId = slugifyRoomId(name);
        }

        const profile = profiles.get(socket.id) ?? defaultProfile;
        const newRoom: InternalRoom = {
          id: roomId,
          name,
          topic,
          visibility,
          passcode,
          createdBy: profile.username,
          creatorSocketId: socket.id,
          createdAt: Date.now(),
          isDefault: false,
          members: new Map(),
          messages: [
            {
              id: crypto.randomUUID(),
              roomId,
              senderId: 'system',
              senderName: 'System',
              senderColor: '#475569',
              text: `${profile.username} started personal meeting "${name}" (Code: ${roomId})`,
              timestamp: Date.now(),
              kind: 'system',
            },
          ],
        };

        rooms.set(roomId, newRoom);
        joinSocketToRoom(socket.id, newRoom, payload?.media);
        ack?.({ ok: true, room: toRoomSummary(newRoom) });
      }
    );

    socket.on(
      'room:join',
      (
        payload: {
          roomId?: string;
          passcode?: string;
          media?: { audioEnabled?: boolean; videoEnabled?: boolean };
        },
        ack?: (res: {
          ok: boolean;
          room?: RoomSummary;
          error?: string;
          requiresPasscode?: boolean;
        }) => void
      ) => {
        const roomId = (payload?.roomId ?? '').trim();
        const room = rooms.get(roomId);
        if (!room) {
          ack?.({
            ok: false,
            error: `Meeting "${roomId}" was not found. Double-check the room code.`,
          });
          return;
        }

        const alreadyMember = room.members.has(socket.id);
        if (
          !alreadyMember &&
          room.passcode &&
          room.passcode !== (payload?.passcode ?? '').trim()
        ) {
          ack?.({
            ok: false,
            requiresPasscode: true,
            error: 'This personal meeting requires a passcode.',
          });
          return;
        }

        joinSocketToRoom(socket.id, room, payload?.media);
        ack?.({ ok: true, room: toRoomSummary(room) });
      }
    );

    socket.on(
      'room:leave',
      (
        payload: { roomId?: string },
        ack?: (res: { ok: boolean }) => void
      ) => {
        const roomId = (payload?.roomId ?? '').trim();
        const room = rooms.get(roomId);
        if (!room || !room.members.has(socket.id)) {
          ack?.({ ok: true });
          return;
        }

        const member = room.members.get(socket.id);
        room.members.delete(socket.id);
        socket.leave(roomId);

        if (member) {
          const leaveMsg: ChatMessage = {
            id: crypto.randomUUID(),
            roomId,
            senderId: 'system',
            senderName: 'System',
            senderColor: '#475569',
            text: `${member.username} left ${room.name}`,
            timestamp: Date.now(),
            kind: 'system',
          };
          appendMessage(room, leaveMsg);
          io.to(roomId).emit('room:message', leaveMsg);
        }

        io.to(roomId).emit('room:members', {
          roomId,
          members: Array.from(room.members.values()),
        });
        syncRoomsToAll();
        ack?.({ ok: true });
      }
    );

    socket.on(
      'room:message',
      (
        payload: {
          roomId?: string;
          text?: string;
          replyTo?: { id: string; senderName: string; text: string };
        },
        ack?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const roomId = (payload?.roomId ?? '').trim();
        const text = (payload?.text ?? '').trim();
        if (!roomId || !text) {
          ack?.({ ok: false, error: 'Message cannot be empty.' });
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          ack?.({ ok: false, error: 'Room not found.' });
          return;
        }

        if (!room.members.has(socket.id)) {
          joinSocketToRoom(socket.id, room);
        }

        const profile = profiles.get(socket.id) ?? defaultProfile;
        const replyTo =
          payload?.replyTo && payload.replyTo.id && payload.replyTo.text
            ? {
                id: String(payload.replyTo.id).slice(0, 64),
                senderName: String(payload.replyTo.senderName || 'Member').slice(0, 40),
                text: String(payload.replyTo.text).slice(0, 180),
              }
            : undefined;

        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          roomId,
          senderId: socket.id,
          senderName: profile.username,
          senderColor: profile.color,
          text: text.slice(0, 2000),
          timestamp: Date.now(),
          kind: 'user',
          replyTo,
          reactions: [],
        };

        appendMessage(room, msg);
        io.to(roomId).emit('room:message', msg);
        ack?.({ ok: true });
      }
    );

    socket.on(
      'room:react',
      (payload: { roomId?: string; messageId?: string; emoji?: string }) => {
        const roomId = (payload?.roomId ?? '').trim();
        const messageId = (payload?.messageId ?? '').trim();
        const emoji = (payload?.emoji ?? '').trim().slice(0, 8);
        if (!roomId || !messageId || !emoji) return;

        const room = rooms.get(roomId);
        if (!room || !room.members.has(socket.id)) return;

        const target = room.messages.find((m) => m.id === messageId);
        if (!target) return;

        const profile = profiles.get(socket.id) ?? defaultProfile;
        const reactions = target.reactions ? [...target.reactions] : [];
        const existingIdx = reactions.findIndex((r) => r.emoji === emoji);

        if (existingIdx >= 0) {
          const entry = reactions[existingIdx];
          const hasReacted = entry.userIds.includes(socket.id);
          if (hasReacted) {
            const nextUserIds = entry.userIds.filter((id) => id !== socket.id);
            const nextNames = entry.usernames.filter((_, i) => entry.userIds[i] !== socket.id);
            if (nextUserIds.length === 0) {
              reactions.splice(existingIdx, 1);
            } else {
              reactions[existingIdx] = {
                emoji,
                userIds: nextUserIds,
                usernames: nextNames,
              };
            }
          } else {
            reactions[existingIdx] = {
              emoji,
              userIds: [...entry.userIds, socket.id],
              usernames: [...entry.usernames, profile.username],
            };
          }
        } else {
          reactions.push({
            emoji,
            userIds: [socket.id],
            usernames: [profile.username],
          });
        }

        target.reactions = reactions;
        io.to(roomId).emit('room:reaction', {
          roomId,
          messageId,
          reactions,
        });
      }
    );

    socket.on(
      'room:typing',
      (payload: { roomId?: string; isTyping?: boolean }) => {
        const roomId = (payload?.roomId ?? '').trim();
        if (!roomId || !rooms.has(roomId)) return;
        const profile = profiles.get(socket.id) ?? defaultProfile;
        socket.to(roomId).emit('room:typing', {
          roomId,
          socketId: socket.id,
          username: profile.username,
          isTyping: Boolean(payload?.isTyping),
        });
      }
    );

    socket.on(
      'media:state',
      (payload: {
        roomId?: string;
        audioEnabled?: boolean;
        videoEnabled?: boolean;
        screenSharing?: boolean;
        handRaised?: boolean;
      }) => {
        const roomId = (payload?.roomId ?? '').trim();
        const room = rooms.get(roomId);
        if (!room) return;
        const member = room.members.get(socket.id);
        if (!member) return;

        if (typeof payload.audioEnabled === 'boolean') {
          member.audioEnabled = payload.audioEnabled;
        }
        if (typeof payload.videoEnabled === 'boolean') {
          member.videoEnabled = payload.videoEnabled;
        }
        if (typeof payload.screenSharing === 'boolean') {
          member.screenSharing = payload.screenSharing;
        }
        if (typeof payload.handRaised === 'boolean') {
          member.handRaised = payload.handRaised;
        }

        io.to(roomId).emit('room:members', {
          roomId,
          members: Array.from(room.members.values()),
        });
      }
    );

    socket.on(
      'meeting:reaction',
      (payload: { roomId?: string; emoji?: string }) => {
        const roomId = (payload?.roomId ?? '').trim();
        const emoji = (payload?.emoji ?? '').trim().slice(0, 8);
        const room = rooms.get(roomId);
        if (!room || !room.members.has(socket.id) || !emoji) return;
        const profile = profiles.get(socket.id) ?? defaultProfile;
        io.to(roomId).emit('meeting:reaction', {
          id: crypto.randomUUID(),
          roomId,
          senderId: socket.id,
          senderName: profile.username,
          emoji,
          timestamp: Date.now(),
        });
      }
    );

    socket.on(
      'webrtc:offer',
      (payload: {
        roomId?: string;
        targetSocketId?: string;
        sdp?: unknown;
      }) => {
        if (!payload?.targetSocketId || !payload?.sdp) return;
        io.to(payload.targetSocketId).emit('webrtc:offer', {
          roomId: payload.roomId,
          fromSocketId: socket.id,
          sdp: payload.sdp,
        });
      }
    );

    socket.on(
      'webrtc:answer',
      (payload: {
        roomId?: string;
        targetSocketId?: string;
        sdp?: unknown;
      }) => {
        if (!payload?.targetSocketId || !payload?.sdp) return;
        io.to(payload.targetSocketId).emit('webrtc:answer', {
          roomId: payload.roomId,
          fromSocketId: socket.id,
          sdp: payload.sdp,
        });
      }
    );

    socket.on(
      'webrtc:ice',
      (payload: {
        roomId?: string;
        targetSocketId?: string;
        candidate?: unknown;
      }) => {
        if (!payload?.targetSocketId || !payload?.candidate) return;
        io.to(payload.targetSocketId).emit('webrtc:ice', {
          roomId: payload.roomId,
          fromSocketId: socket.id,
          candidate: payload.candidate,
        });
      }
    );

    socket.on(
      'announcement:send',
      (
        payload: { text?: string },
        ack?: (res: { ok: boolean }) => void
      ) => {
        const text = (payload?.text ?? '').trim().slice(0, 240);
        if (!text) {
          ack?.({ ok: false });
          return;
        }
        const profile = profiles.get(socket.id) ?? defaultProfile;
        io.emit('announcement', `${profile.username}: ${text}`);
        ack?.({ ok: true });
      }
    );

    socket.on('disconnect', () => {
      count = Math.max(0, count - 1);
      console.log('Active user: ', count);
      io.emit('active:count', count);

      const profile = profiles.get(socket.id);
      profiles.delete(socket.id);

      let changed = false;
      for (const room of rooms.values()) {
        if (room.members.has(socket.id)) {
          room.members.delete(socket.id);
          changed = true;

          if (profile) {
            const leaveMsg: ChatMessage = {
              id: crypto.randomUUID(),
              roomId: room.id,
              senderId: 'system',
              senderName: 'System',
              senderColor: '#475569',
              text: `${profile.username} disconnected`,
              timestamp: Date.now(),
              kind: 'system',
            };
            appendMessage(room, leaveMsg);
            io.to(room.id).emit('room:message', leaveMsg);
          }

          io.to(room.id).emit('room:members', {
            roomId: room.id,
            members: Array.from(room.members.values()),
          });
        }
      }

      if (changed) {
        syncRoomsToAll();
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  httpserver.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
