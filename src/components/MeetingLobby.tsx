import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Globe,
  KeyRound,
  Lock,
  Megaphone,
  Mic,
  MicOff,
  Moon,
  Pencil,
  Sun,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import type { RoomSummary } from '../types/chat';
import { Avatar } from './Avatar';

interface MeetingLobbyProps {
  username: string;
  userColor: string;
  colorChoices: string[];
  theme: 'light' | 'dark';
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  activeUserCount: number;
  rooms: RoomSummary[];
  announcement: string | null;
  localStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  mediaError: string | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onDismissAnnouncement: () => void;
  onDismissMediaError: () => void;
  onToggleTheme: () => void;
  onUpdateProfile: (name: string, color: string) => void;
  onOpenCreateMeeting: () => void;
  onInstantMeeting: () => void;
  onJoinByCode: (codeOrUrl: string) => void;
  onJoinRoom: (roomId: string) => void;
}

export const MeetingLobby: React.FC<MeetingLobbyProps> = ({
  username,
  userColor,
  colorChoices,
  theme,
  connectionStatus,
  activeUserCount,
  rooms,
  announcement,
  localStream,
  audioEnabled,
  videoEnabled,
  mediaError,
  onToggleAudio,
  onToggleVideo,
  onDismissAnnouncement,
  onDismissMediaError,
  onToggleTheme,
  onUpdateProfile,
  onOpenCreateMeeting,
  onInstantMeeting,
  onJoinByCode,
  onJoinRoom,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(username);
  const [draftColor, setDraftColor] = useState(userColor);
  const [now, setNow] = useState(() => new Date());

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = previewVideoRef.current;
    if (!el) return;
    if (el.srcObject !== localStream) {
      el.srcObject = localStream;
    }
  }, [localStream, videoEnabled]);

  const hasLiveVideo = Boolean(
    localStream &&
      localStream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
  );

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;
    onJoinByCode(joinInput.trim());
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim().slice(0, 28) || username;
    onUpdateProfile(cleaned, draftColor);
    setEditingProfile(false);
  };

  const timeString = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateString = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const statusMeta =
    connectionStatus === 'connected'
      ? { dot: 'bg-emerald-500', text: 'Connected' }
      : connectionStatus === 'reconnecting'
      ? { dot: 'bg-amber-500', text: 'Reconnecting' }
      : { dot: 'bg-red-500', text: 'Offline' };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Clean Top Bar */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Video className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Official Meet
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
            <span>{timeString}</span>
            <span aria-hidden="true">·</span>
            <span>{dateString}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
            <span>{statusMeta.text}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{activeUserCount} online</span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setDraftName(username);
              setDraftColor(userColor);
              setEditingProfile((v) => !v);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
            title="Edit display name"
          >
            <Avatar name={username} color={userColor} size="sm" />
            <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">
              {username}
            </span>
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Inline Profile Editor */}
      {editingProfile && (
        <div className="border-b border-slate-200 dark:border-slate-800 bg-sky-50/70 dark:bg-slate-900 px-4 sm:px-8 py-3">
          <form
            onSubmit={handleSaveProfile}
            className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="lobby-username"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Your name
              </label>
              <input
                id="lobby-username"
                type="text"
                maxLength={28}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                {colorChoices.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraftColor(color)}
                    className={`w-5 h-5 rounded-md transition-transform ${
                      draftColor === color
                        ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-900 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Server Announcement Strip */}
      {announcement && (
        <div className="px-4 sm:px-8 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
            <Megaphone className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="font-medium shrink-0">Server Announcement:</span>
            <span className="truncate">{announcement}</span>
          </div>
          <button
            type="button"
            onClick={onDismissAnnouncement}
            className="p-1 rounded text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0"
            aria-label="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Split Content */}
      <main className="flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15] [text-wrap:balance]">
                Bright, reliable video meetings for every team.
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Launch an instant Official Meet room, invite multiple participants with one link, or join an active room with a code.
              </p>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onInstantMeeting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs transition-colors whitespace-nowrap"
                >
                  <Video className="w-4 h-4" />
                  <span>New Meeting</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateMeeting}
                  className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Custom Room
                </button>
              </div>

              <form
                onSubmit={handleJoinSubmit}
                className="flex-1 flex items-center gap-2"
              >
                <div className="relative flex-1 min-w-0">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Enter a code or link"
                    aria-label="Enter a meeting code or link"
                    className="w-full pl-10 pr-3 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className="px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Join
                </button>
              </form>
            </div>

            {/* Active Public Rooms */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Available Meeting Rooms</span>
                <span className="tabular-nums">{rooms.length} listed</span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/50 shadow-2xs">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-sky-50/50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-slate-950 border border-sky-100 dark:border-slate-800 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                        {room.visibility === 'private' ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {room.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Users className="w-3 h-3" />
                            {room.memberCount} in call
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{room.id}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onJoinRoom(room.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Pure White Studio Self-Preview Card */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${
                  videoEnabled && hasLiveVideo ? 'block' : 'hidden'
                }`}
              />

              {(!videoEnabled || !hasLiveVideo) && (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Avatar name={username} color={userColor} size="lg" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Camera is off
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Turn on your camera or microphone below before joining.
                    </p>
                  </div>
                </div>
              )}

              {/* Top-left preview identity */}
              <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded-lg bg-white/90 dark:bg-slate-950/80 backdrop-blur-xs border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-2xs">
                {username}
              </div>

              {/* Bottom centered mic & camera studio controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onToggleAudio}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-colors ${
                    audioEnabled
                      ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-600'
                      : 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                  }`}
                  aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {audioEnabled ? (
                    <Mic className="w-5 h-5" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onToggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-colors ${
                    videoEnabled
                      ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-600'
                      : 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                  }`}
                  aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {videoEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {mediaError && (
              <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                <span>{mediaError}</span>
                <button
                  type="button"
                  onClick={onDismissMediaError}
                  className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Audio: {audioEnabled ? 'Ready' : 'Muted'} · Video:{' '}
              {videoEnabled ? 'On' : 'Off'} · Ready to join as{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {username}
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
