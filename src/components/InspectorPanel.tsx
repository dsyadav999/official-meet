import React, { useState } from 'react';
import { Check, Copy, LogOut, Megaphone, Radio, Send, X } from 'lucide-react';
import type { RoomMember, RoomSummary, ServerEventEntry } from '../types/chat';
import { Avatar } from './Avatar';

interface InspectorPanelProps {
  isOpen: boolean;
  room: RoomSummary | undefined;
  members: RoomMember[];
  currentSocketId: string;
  events: ServerEventEntry[];
  inviteCopied: boolean;
  onClose: () => void;
  onCopyInvite: () => void;
  onLeaveRoom: (roomId: string) => void;
  onEmitFr: (payload: string) => void;
  onSendAnnouncement: (text: string) => void;
}

function formatEventTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  isOpen,
  room,
  members,
  currentSocketId,
  events,
  inviteCopied,
  onClose,
  onCopyInvite,
  onLeaveRoom,
  onEmitFr,
  onSendAnnouncement,
}) => {
  const [tab, setTab] = useState<'members' | 'events'>('members');
  const [frInput, setFrInput] = useState('Hello from Client side');
  const [announceInput, setAnnounceInput] = useState('');

  if (!isOpen) return null;

  const handleEmitFr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frInput.trim()) return;
    onEmitFr(frInput.trim());
    setFrInput('');
  };

  const handleAnnounce = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceInput.trim()) return;
    onSendAnnouncement(announceInput.trim());
    setAnnounceInput('');
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-80 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col xl:static">
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-950">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex-1">
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'members'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('events')}
            className={`flex-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'events'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Socket Events
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 xl:hidden shrink-0"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {tab === 'members' ? (
        <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-5">
          {room && (
            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Room Invite</span>
                <span>
                  {room.visibility === 'private' ? 'Private' : 'Public'}
                  {room.hasPasscode ? ' · Passcode' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <code className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                  {room.id}
                </code>
                <button
                  type="button"
                  onClick={onCopyInvite}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 whitespace-nowrap"
                >
                  {inviteCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {room.topic}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5 px-1">
              In this room ({members.length})
            </h3>
            <ul className="space-y-1.5">
              {members.map((member) => {
                const isSelf = member.socketId === currentSocketId;
                const isHost = room?.creatorSocketId === member.socketId;
                return (
                  <li
                    key={member.socketId}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={member.username}
                        color={member.color}
                        size="sm"
                        online
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {member.username}
                          {isSelf && (
                            <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
                          {member.socketId.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                    {isHost && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                        Host
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {room && !room.isDefault && (
            <button
              type="button"
              onClick={() => onLeaveRoom(room.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave Personal Room
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
            <form onSubmit={handleEmitFr} className="space-y-1.5">
              <label
                htmlFor="fr-payload"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Test <code className="font-mono text-slate-900 dark:text-slate-100">fr</code> event
              </label>
              <div className="flex gap-1.5">
                <input
                  id="fr-payload"
                  type="text"
                  value={frInput}
                  onChange={(e) => setFrInput(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  Emit
                </button>
              </div>
            </form>

            <form onSubmit={handleAnnounce} className="space-y-1.5">
              <label
                htmlFor="announce-payload"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Broadcast <code className="font-mono text-slate-900 dark:text-slate-100">announcement</code>
              </label>
              <div className="flex gap-1.5">
                <input
                  id="announce-payload"
                  type="text"
                  value={announceInput}
                  onChange={(e) => setAnnounceInput(e.target.value)}
                  placeholder="Global notice to all users"
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="p-1.5 text-white bg-slate-800 dark:bg-slate-700 rounded-md hover:bg-slate-900 dark:hover:bg-slate-600 shrink-0"
                  aria-label="Broadcast announcement"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto chat-scroll p-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                Waiting for Socket.IO events...
              </p>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {ev.direction === 'incoming' ? '↓ ' : '↑ '}
                      {ev.event}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {formatEventTime(ev.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 break-words leading-snug">
                    {ev.payload}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
