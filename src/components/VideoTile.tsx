import React, { useEffect, useRef } from 'react';
import { Hand, Mic, MicOff, MonitorUp, Pin, PinOff } from 'lucide-react';
import type { RoomMember } from '../types/chat';
import { Avatar } from './Avatar';

interface VideoTileProps {
  member: RoomMember;
  stream: MediaStream | null;
  isSelf: boolean;
  isHost: boolean;
  isPinned: boolean;
  compact?: boolean;
  onTogglePin: (socketId: string) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  member,
  stream,
  isSelf,
  isHost,
  isPinned,
  compact = false,
  onTogglePin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const hasLiveVideoTrack = Boolean(
    stream &&
      stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
  );
  const showVideo =
    (member.videoEnabled || member.screenSharing) && hasLiveVideoTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream, showVideo]);

  const mirror = isSelf && !member.screenSharing;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border transition-colors flex items-center justify-center shadow-xs ${
        member.handRaised
          ? 'border-amber-400 ring-2 ring-amber-400/25'
          : isPinned
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      } ${compact ? 'aspect-video' : 'w-full h-full min-h-[200px]'}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={`w-full h-full ${
          member.screenSharing ? 'object-contain bg-slate-950' : 'object-cover'
        } ${mirror ? '-scale-x-100' : ''} ${showVideo ? 'block' : 'hidden'}`}
      />

      {!showVideo && (
        <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3 p-4 select-none">
          <Avatar name={member.username} color={member.color} size="lg" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {member.videoEnabled ? 'Connecting video...' : 'Camera off'}
          </span>
        </div>
      )}

      {/* Top Left Status Indicators */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        {member.handRaised && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold shadow-xs">
            <Hand className="w-3.5 h-3.5" />
            <span>Hand raised</span>
          </div>
        )}
        {member.screenSharing && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium shadow-xs">
            <MonitorUp className="w-3.5 h-3.5" />
            <span>Presenting</span>
          </div>
        )}
      </div>

      {/* Top Right Pin Action */}
      <button
        type="button"
        onClick={() => onTogglePin(member.socketId)}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity absolute top-3 right-3 p-2 rounded-lg bg-white/90 dark:bg-slate-950/80 hover:bg-white dark:hover:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs"
        title={isPinned ? 'Unpin tile' : 'Pin to main stage'}
        aria-label={isPinned ? 'Unpin tile' : 'Pin to main stage'}
      >
        {isPinned ? (
          <PinOff className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <Pin className="w-4 h-4" />
        )}
      </button>

      {/* Bottom Left Name & Mic Status */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/92 dark:bg-slate-950/80 backdrop-blur-xs border border-slate-200/90 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-2xs max-w-full">
          {member.audioEnabled ? (
            <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
          )}
          <span className="truncate">
            {member.username}
            {isSelf ? ' (You)' : ''}
            {isHost && !isSelf ? ' · Host' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
