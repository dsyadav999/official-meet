export type RoomVisibility = 'public' | 'private';

export interface RoomSummary {
  id: string;
  name: string;
  topic: string;
  visibility: RoomVisibility;
  hasPasscode: boolean;
  createdBy: string;
  creatorSocketId: string;
  createdAt: number;
  memberCount: number;
  isDefault?: boolean;
}

export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
}

export interface RoomMember extends MediaState {
  socketId: string;
  username: string;
  color: string;
  joinedAt: number;
}

export type MessageKind = 'user' | 'system' | 'fr' | 'announcement';

export interface MessageReplyRef {
  id: string;
  senderName: string;
  text: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
  usernames: string[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  kind: MessageKind;
  replyTo?: MessageReplyRef;
  reactions?: MessageReaction[];
}

export interface RoomStatePayload {
  room: RoomSummary;
  members: RoomMember[];
  messages: ChatMessage[];
}

export interface TypingPayload {
  roomId: string;
  socketId: string;
  username: string;
  isTyping: boolean;
}

export interface FloatingReaction {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  emoji: string;
  timestamp: number;
}

export interface ServerEventEntry {
  id: string;
  event: string;
  direction: 'incoming' | 'outgoing';
  payload: string;
  timestamp: number;
}
