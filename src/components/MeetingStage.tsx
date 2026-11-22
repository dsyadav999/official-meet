import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Hand,
  Lock,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Radio,
  Send,
  Share2,
  Smile,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  FloatingReaction,
  MessageReplyRef,
  RoomMember,
  RoomSummary,
  ServerEventEntry,
  TypingPayload,
} from '../types/chat';
import { Avatar } from './Avatar';
import { MessageStream } from './MessageStream';
import { VideoTile } from './VideoTile';

interface MeetingStageProps {
  room: RoomSummary | undefined;
  roomId: string;
  members: RoomMember[];
  currentSocketId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  mediaError: string | null;
  messages: ChatMessage[];
  typingUsers: TypingPayload[];
  unreadChatCount: number;
  announcement: string | null;
  events: ServerEventEntry[];
  floatingReactions: FloatingReaction[];
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onSendMeetingReaction: (emoji: string) => void;
  onLeaveMeeting: () => void;
  onSendMessage: (text: string, replyTo?: MessageReplyRef) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  onEmitFr: (payload: string) => void;
  onSendAnnouncement: (text: string) => void;
  onDismissAnnouncement: () => void;
  onDismissMediaError: () => void;
  onClearUnreadChat: () => void;
}

const MEETING_REACTIONS = ['👍', '❤️', '🎉', '👏', '😂', '🚀'];

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatEventTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const MeetingStage: React.FC<MeetingStageProps> = ({
  room,
  roomId,
  members,
  currentSocketId,
  localStream,
  screenStream,
  remoteStreams,
  audioEnabled,
  videoEnabled,
  screenSharing,
  handRaised,
  mediaError,
  messages,
  typingUsers,
  unreadChatCount,
  announcement,
  events,
  floatingReactions,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHandRaise,
  onSendMeetingReaction,
  onLeaveMeeting,
  onSendMessage,
  onReactMessage,
  onTypingChange,
  onEmitFr,
  onSendAnnouncement,
  onDismissAnnouncement,
  onDismissMediaError,
  onClearUnreadChat,
}) => {
  const [drawerTab, setDrawerTab] = useState<'chat' | 'people' | 'events' | null>(
    null
  );
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [frInput, setFrInput] = useState('Hello from Client side');
  const [announceInput, setAnnounceInput] = useState('');

  useEffect(() => {
    setElapsedSeconds(0);
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [roomId]);

  useEffect(() => {
    if (drawerTab === 'chat' && unreadChatCount > 0) {
      onClearUnreadChat();
    }
  }, [drawerTab, unreadChatCount, onClearUnreadChat]);

  const toggleDrawer = (tab: 'chat' | 'people' | 'events') => {
    setDrawerTab((prev) => (prev === tab ? null : tab));
  };

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      // Ignore clipboard error
    }
  };

  const getStreamForMember = (member: RoomMember): MediaStream | null => {
    if (member.socketId === currentSocketId) {
      if (screenSharing && screenStream) return screenStream;
      return localStream;
    }
    return remoteStreams[member.socketId] ?? null;
  };

  const presenterMember = members.find((m) => m.screenSharing);
  const effectivePinnedId =
    pinnedSocketId && members.some((m) => m.socketId === pinnedSocketId)
      ? pinnedSocketId
      : presenterMember?.socketId ?? null;

  const spotlightMember = effectivePinnedId
    ? members.find((m) => m.socketId === effectivePinnedId) ?? null
    : null;
  const sideMembers = spotlightMember
    ? members.filter((m) => m.socketId !== spotlightMember.socketId)
    : [];

  const gridColsClass =
    members.length <= 1
      ? 'grid-cols-1 max-w-4xl mx-auto'
      : members.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : members.length <= 4
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Top Meeting Header */}
      <header className="h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Video className="w-3.5 h-3.5" />
          </div>
          <span className="hidden lg:inline text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 shrink-0">
            Official Meet
          </span>
          <span className="hidden lg:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          {room?.visibility === 'private' && (
            <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          )}
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
            {room?.name || roomId}
          </h1>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            {formatDuration(elapsedSeconds)}
          </span>
          <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-slate-200 transition-colors shrink-0"
            title="Copy room code"
          >
            <span>{roomId}</span>
            {codeCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyInvite}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {inviteCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline">Copy Invite Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('events')}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              drawerTab === 'events'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Events</span>
          </button>
        </div>
      </header>

      {/* Server Announcement Banner */}
      {announcement && (
        <div className="px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
            <Megaphone className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="font-medium shrink-0">Announcement:</span>
            <span className="truncate">{announcement}</span>
          </div>
          <button
            type="button"
            onClick={onDismissAnnouncement}
            className="p-1 rounded text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 shrink-0"
            aria-label="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Media permission error strip */}
      {mediaError && (
        <div className="px-4 sm:px-6 py-2 bg-red-50 dark:bg-red-950/70 border-b border-red-200 dark:border-red-900/70 flex items-center justify-between gap-3 shrink-0 text-xs text-red-800 dark:text-red-200">
          <span>{mediaError}</span>
          <button
            type="button"
            onClick={onDismissMediaError}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 shrink-0"
            aria-label="Dismiss media notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Stage + Optional Side Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Video Grid Area */}
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto chat-scroll flex flex-col relative">
          {spotlightMember ? (
            <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
              <div className="flex-1 min-h-[280px]">
                <VideoTile
                  member={spotlightMember}
                  stream={getStreamForMember(spotlightMember)}
                  isSelf={spotlightMember.socketId === currentSocketId}
                  isHost={room?.creatorSocketId === spotlightMember.socketId}
                  isPinned={spotlightMember.socketId === pinnedSocketId}
                  onTogglePin={(sid) =>
                    setPinnedSocketId((prev) => (prev === sid ? null : sid))
                  }
                />
              </div>
              {sideMembers.length > 0 && (
                <div className="lg:w-64 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto chat-scroll shrink-0">
                  {sideMembers.map((member) => (
                    <div key={member.socketId} className="w-48 lg:w-full shrink-0">
                      <VideoTile
                        member={member}
                        stream={getStreamForMember(member)}
                        isSelf={member.socketId === currentSocketId}
                        isHost={room?.creatorSocketId === member.socketId}
                        isPinned={false}
                        compact
                        onTogglePin={(sid) => setPinnedSocketId(sid)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`flex-1 w-full grid gap-3 sm:gap-4 auto-rows-fr ${gridColsClass}`}
            >
              {members.map((member) => (
                <VideoTile
                  key={member.socketId}
                  member={member}
                  stream={getStreamForMember(member)}
                  isSelf={member.socketId === currentSocketId}
                  isHost={room?.creatorSocketId === member.socketId}
                  isPinned={false}
                  onTogglePin={(sid) => setPinnedSocketId(sid)}
                />
              ))}
            </div>
          )}

          {/* Floating Meeting Reactions */}
          {floatingReactions.length > 0 && (
            <div className="pointer-events-none absolute bottom-6 left-6 z-20 flex flex-col gap-2">
              {floatingReactions.map((r) => (
                <div
                  key={r.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-sm shadow-md"
                >
                  <span className="text-lg">{r.emoji}</span>
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {r.senderName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible Right Drawer */}
        {drawerTab && (
          <aside className="fixed inset-y-14 right-0 bottom-20 z-30 w-full sm:w-96 lg:static lg:inset-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
            <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex-1">
                <button
                  type="button"
                  onClick={() => setDrawerTab('chat')}
                  className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    drawerTab === 'chat'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  In-Call Chat
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('people')}
                  className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    drawerTab === 'people'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  People ({members.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('events')}
                  className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    drawerTab === 'events'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Events
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDrawerTab(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {drawerTab === 'chat' && (
              <MessageStream
                room={room}
                messages={messages}
                currentSocketId={currentSocketId}
                typingUsers={typingUsers}
                onSendMessage={onSendMessage}
                onReactMessage={onReactMessage}
                onTypingChange={onTypingChange}
                onCopyInvite={handleCopyInvite}
                inviteCopied={inviteCopied}
              />
            )}

            {drawerTab === 'people' && (
              <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Invite others to Official Meet
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <code className="text-xs font-mono truncate">{roomId}</code>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      {inviteCopied ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>

                <ul className="space-y-2">
                  {members.map((member) => {
                    const isSelf = member.socketId === currentSocketId;
                    const isHost = room?.creatorSocketId === member.socketId;
                    return (
                      <li
                        key={member.socketId}
                        className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={member.username}
                            color={member.color}
                            size="sm"
                            online
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {member.username}
                              {isSelf && (
                                <span className="ml-1 text-xs font-normal text-slate-400">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">
                              {isHost ? 'Host' : 'Participant'}
                              {member.handRaised ? ' · Hand raised' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {member.handRaised && (
                            <Hand className="w-4 h-4 text-amber-500" />
                          )}
                          {member.audioEnabled ? (
                            <Mic className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <MicOff className="w-4 h-4 text-slate-400" />
                          )}
                          {member.videoEnabled ? (
                            <Video className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <VideoOff className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {drawerTab === 'events' && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!frInput.trim()) return;
                      onEmitFr(frInput.trim());
                      setFrInput('');
                    }}
                    className="space-y-1.5"
                  >
                    <label
                      htmlFor="meeting-fr-input"
                      className="text-xs font-medium text-slate-700 dark:text-slate-300 block"
                    >
                      Emit original <code className="font-mono">fr</code> event
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="meeting-fr-input"
                        type="text"
                        value={frInput}
                        onChange={(e) => setFrInput(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 whitespace-nowrap"
                      >
                        Emit
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!announceInput.trim()) return;
                      onSendAnnouncement(announceInput.trim());
                      setAnnounceInput('');
                    }}
                    className="space-y-1.5"
                  >
                    <label
                      htmlFor="meeting-announce-input"
                      className="text-xs font-medium text-slate-700 dark:text-slate-300 block"
                    >
                      Broadcast <code className="font-mono">announcement</code>
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="meeting-announce-input"
                        type="text"
                        value={announceInput}
                        onChange={(e) => setAnnounceInput(e.target.value)}
                        placeholder="Send notice to everyone..."
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="submit"
                        className="p-1.5 text-white bg-slate-800 dark:bg-slate-700 rounded-md hover:bg-slate-700"
                        aria-label="Send announcement"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="flex-1 overflow-y-auto chat-scroll p-3 space-y-2">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">
                          {ev.direction === 'incoming' ? '↓ ' : '↑ '}
                          {ev.event}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {formatEventTime(ev.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 break-words">
                        {ev.payload}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Bright Control Dock */}
      <footer className="h-20 px-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono min-w-[160px]">
          <span>{roomId}</span>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-1">
          <button
            type="button"
            onClick={onToggleAudio}
            className={`h-11 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 text-xs font-medium border transition-colors whitespace-nowrap ${
              audioEnabled
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
                : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-600 dark:hover:bg-red-700 dark:text-white dark:border-red-500'
            }`}
            aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {audioEnabled ? (
              <Mic className="w-4 h-4 shrink-0" />
            ) : (
              <MicOff className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden md:inline">
              {audioEnabled ? 'Mute' : 'Unmute'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleVideo}
            className={`h-11 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 text-xs font-medium border transition-colors whitespace-nowrap ${
              videoEnabled
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
                : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-600 dark:hover:bg-red-700 dark:text-white dark:border-red-500'
            }`}
            aria-label={videoEnabled ? 'Stop video' : 'Start video'}
          >
            {videoEnabled ? (
              <Video className="w-4 h-4 shrink-0" />
            ) : (
              <VideoOff className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden md:inline">
              {videoEnabled ? 'Stop Video' : 'Start Video'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`h-11 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 text-xs font-medium border transition-colors whitespace-nowrap ${
              screenSharing
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
            }`}
            aria-label={screenSharing ? 'Stop presenting' : 'Share screen'}
          >
            <MonitorUp className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">
              {screenSharing ? 'Stop Share' : 'Present'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleHandRaise}
            className={`h-11 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 text-xs font-medium border transition-colors whitespace-nowrap ${
              handRaised
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-400'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
            }`}
            aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">
              {handRaised ? 'Lower' : 'Raise Hand'}
            </span>
          </button>

          <div className="relative">
            {reactionPickerOpen && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl flex items-center gap-1">
                {MEETING_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSendMeetingReaction(emoji);
                      setReactionPickerOpen(false);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setReactionPickerOpen((v) => !v)}
              className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-colors ${
                reactionPickerOpen
                  ? 'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-slate-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
              }`}
              aria-label="Send reaction"
              title="Send reaction"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => toggleDrawer('chat')}
            className={`relative h-11 px-3.5 rounded-xl flex items-center gap-2 text-xs font-medium border transition-colors whitespace-nowrap ${
              drawerTab === 'chat'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
            }`}
            aria-label="Toggle in-call chat"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">Chat</span>
            {unreadChatCount > 0 && drawerTab !== 'chat' && (
              <span className="tabular-nums text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                {unreadChatCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('people')}
            className={`h-11 px-3.5 rounded-xl flex items-center gap-2 text-xs font-medium border transition-colors whitespace-nowrap ${
              drawerTab === 'people'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700'
            }`}
            aria-label="Toggle participants list"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="tabular-nums">{members.length}</span>
          </button>

          <button
            type="button"
            onClick={onLeaveMeeting}
            className="h-11 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 text-xs font-semibold transition-colors whitespace-nowrap shadow-xs"
            aria-label="Leave meeting"
          >
            <PhoneOff className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center justify-end min-w-[160px] text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <span>{members.length} in meeting</span>
        </div>
      </footer>
    </div>
  );
};
