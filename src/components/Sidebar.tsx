import React, { useState } from 'react';
import {
  Check,
  Hash,
  KeyRound,
  Lock,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react';
import type { RoomSummary } from '../types/chat';
import { Avatar } from './Avatar';

interface SidebarProps {
  rooms: RoomSummary[];
  activeRoomId: string;
  unreadByRoom: Record<string, number>;
  username: string;
  userColor: string;
  colorChoices: string[];
  theme: 'light' | 'dark';
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  activeUserCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  onUpdateProfile: (name: string, color: string) => void;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  activeRoomId,
  unreadByRoom,
  username,
  userColor,
  colorChoices,
  theme,
  connectionStatus,
  activeUserCount,
  mobileOpen,
  onCloseMobile,
  onSelectRoom,
  onOpenCreateRoom,
  onOpenJoinRoom,
  onUpdateProfile,
  onToggleTheme,
}) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(username);
  const [draftColor, setDraftColor] = useState(userColor);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRooms = normalizedQuery
    ? rooms.filter(
        (r) =>
          r.name.toLowerCase().includes(normalizedQuery) ||
          r.id.toLowerCase().includes(normalizedQuery)
      )
    : rooms;

  const publicRooms = filteredRooms.filter((r) => r.visibility === 'public');
  const personalRooms = filteredRooms.filter((r) => r.visibility === 'private');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim().slice(0, 28) || username;
    onUpdateProfile(cleaned, draftColor);
    setEditingProfile(false);
  };

  const statusMeta =
    connectionStatus === 'connected'
      ? { dot: 'bg-emerald-500', text: 'Connected' }
      : connectionStatus === 'reconnecting'
      ? { dot: 'bg-amber-500', text: 'Reconnecting' }
      : { dot: 'bg-red-500', text: 'Disconnected' };

  const renderRoomItem = (room: RoomSummary) => {
    const isActive = room.id === activeRoomId;
    const unread = unreadByRoom[room.id] || 0;

    return (
      <button
        key={room.id}
        type="button"
        onClick={() => {
          onSelectRoom(room.id);
          onCloseMobile();
        }}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
          isActive
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {room.visibility === 'private' ? (
            <Lock
              className={`w-4 h-4 shrink-0 ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
          ) : (
            <Hash
              className={`w-4 h-4 shrink-0 ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{room.name}</div>
            {room.visibility === 'private' && (
              <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
                {room.id}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 tabular-nums text-xs">
          {unread > 0 && !isActive && (
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {unread > 99 ? '99+' : unread} new
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500">{room.memberCount}</span>
        </div>
      </button>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[276px] bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Relay
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions + Room Search */}
        <div className="p-3.5 space-y-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenCreateRoom}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              New Room
            </button>
            <button
              type="button"
              onClick={onOpenJoinRoom}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
              Join Code
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter rooms..."
              aria-label="Filter rooms"
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto chat-scroll px-3 py-4 space-y-6">
          <section>
            <div className="px-2 mb-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Public Channels</span>
              <span className="tabular-nums">{publicRooms.length}</span>
            </div>
            {publicRooms.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500">
                No matching public channels.
              </p>
            ) : (
              <div className="space-y-1">{publicRooms.map(renderRoomItem)}</div>
            )}
          </section>

          <section>
            <div className="px-2 mb-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Personal Rooms</span>
              <span className="tabular-nums">{personalRooms.length}</span>
            </div>
            {personalRooms.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {normalizedQuery
                  ? 'No matching personal rooms.'
                  : 'Create a personal room to get a private invite link for your group.'}
              </p>
            ) : (
              <div className="space-y-1">{personalRooms.map(renderRoomItem)}</div>
            )}
          </section>
        </div>

        {/* User Profile & Real Connection Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
          {editingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={28}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                  aria-label="Save profile"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(username);
                    setDraftColor(userColor);
                    setEditingProfile(false);
                  }}
                  className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
                  aria-label="Cancel profile edit"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
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
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  name={username}
                  color={userColor}
                  size="sm"
                  online={connectionStatus === 'connected'}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {username}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                    <span>{statusMeta.text}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{activeUserCount} online</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftName(username);
                  setDraftColor(userColor);
                  setEditingProfile(true);
                }}
                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                title="Edit name & avatar color"
                aria-label="Edit name & avatar color"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
