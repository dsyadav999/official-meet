import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  CornerUpLeft,
  Send,
  Smile,
  Users,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  MessageReplyRef,
  RoomSummary,
  TypingPayload,
} from '../types/chat';
import { Avatar } from './Avatar';

interface MessageStreamProps {
  room: RoomSummary | undefined;
  messages: ChatMessage[];
  currentSocketId: string;
  typingUsers: TypingPayload[];
  onSendMessage: (text: string, replyTo?: MessageReplyRef) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  onCopyInvite: () => void;
  inviteCopied: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '🎉', '🚀'];
const COMPOSER_EMOJIS = [
  '👍',
  '❤️',
  '🎉',
  '🚀',
  '🔥',
  '👏',
  '😊',
  '😂',
  '🤔',
  '👀',
  '✅',
  '💡',
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export const MessageStream: React.FC<MessageStreamProps> = ({
  room,
  messages,
  currentSocketId,
  typingUsers,
  onSendMessage,
  onReactMessage,
  onTypingChange,
  onCopyInvite,
  inviteCopied,
}) => {
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageReplyRef | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, room?.id]);

  useEffect(() => {
    setReplyingTo(null);
    setEmojiOpen(false);
  }, [room?.id]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const stopTyping = () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange(false);
    }
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  };

  const handleInputChange = (value: string) => {
    setDraft(value);
    adjustTextareaHeight();

    if (!value.trim()) {
      stopTyping();
      return;
    }
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingChange(true);
    }
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      isTypingRef.current = false;
      onTypingChange(false);
    }, 1800);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned) return;
    onSendMessage(cleaned, replyingTo ?? undefined);
    setDraft('');
    setReplyingTo(null);
    setEmojiOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    stopTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const insertEmoji = (emoji: string) => {
    const next = `${draft}${emoji}`;
    setDraft(next);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const userMessages = messages.filter((m) => m.kind !== 'system');
  const activeTypers = typingUsers.filter((t) => t.socketId !== currentSocketId);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950">
      {/* Scrollable Timeline */}
      <div className="flex-1 overflow-y-auto chat-scroll py-5">
        {room && userMessages.length === 0 && (
          <div className="max-w-lg mx-auto my-8 mx-4 sm:mx-auto p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3.5">
            <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {room.name}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {room.topic}
              </p>
            </div>
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Code:</span>
              <code className="font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-md">
                {room.id}
              </code>
              <button
                type="button"
                onClick={onCopyInvite}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md transition-colors whitespace-nowrap"
              >
                {inviteCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Invite link copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy invite link
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {messages.map((msg, index) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const showDayDivider =
              !prev || getDayKey(prev.timestamp) !== getDayKey(msg.timestamp);

            const isGrouped =
              !showDayDivider &&
              prev &&
              prev.kind !== 'system' &&
              msg.kind !== 'system' &&
              prev.senderId === msg.senderId &&
              msg.timestamp - prev.timestamp < 3 * 60 * 1000 &&
              !msg.replyTo;

            const isSelf = msg.senderId === currentSocketId;

            return (
              <React.Fragment key={msg.id}>
                {showDayDivider && (
                  <div className="flex items-center gap-3 px-6 py-3">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {formatDayLabel(msg.timestamp)}
                    </span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  </div>
                )}

                {msg.kind === 'system' ? (
                  <div className="px-6 py-1.5 flex items-center justify-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
                      {msg.text} ·{' '}
                      <span className="tabular-nums">{formatTime(msg.timestamp)}</span>
                    </span>
                  </div>
                ) : (
                  <div
                    className={`group relative px-4 sm:px-6 transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-900/60 ${
                      isGrouped ? 'py-0.5' : 'pt-2.5 pb-1'
                    }`}
                  >
                    {/* Hover Quick Actions Toolbar */}
                    <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5 absolute right-5 -top-3 z-10 px-1 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReactMessage(msg.id, emoji)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo({
                            id: msg.id,
                            senderName: msg.senderName,
                            text: msg.text.slice(0, 120),
                          });
                          textareaRef.current?.focus();
                        }}
                        className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Reply"
                        aria-label="Reply to message"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg)}
                        className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy message"
                        aria-label="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-start gap-3">
                      {isGrouped ? (
                        <div className="w-9 shrink-0 flex justify-end pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      ) : (
                        <Avatar name={msg.senderName} color={msg.senderColor} />
                      )}

                      <div className="min-w-0 flex-1">
                        {!isGrouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span
                              className={`text-sm font-semibold ${
                                isSelf
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {msg.senderName}
                            </span>
                            {isSelf && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                You
                              </span>
                            )}
                            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                              {formatTime(msg.timestamp)}
                            </span>
                            {msg.kind === 'fr' && (
                              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                                · via fr
                              </span>
                            )}
                          </div>
                        )}

                        {msg.replyTo && (
                          <div className="mb-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              Replying to {msg.replyTo.senderName}:{' '}
                            </span>
                            <span className="truncate">{msg.replyTo.text}</span>
                          </div>
                        )}

                        <p className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words max-w-[72ch]">
                          {msg.text}
                        </p>

                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {msg.reactions.map((reaction) => {
                              const reacted = reaction.userIds.includes(currentSocketId);
                              return (
                                <button
                                  key={reaction.emoji}
                                  type="button"
                                  onClick={() => onReactMessage(msg.id, reaction.emoji)}
                                  title={reaction.usernames.join(', ')}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors tabular-nums ${
                                    reacted
                                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span>{reaction.userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Typing Status + Composer */}
      <div className="px-4 sm:px-6 pb-4 pt-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
        <div className="h-5 mb-1 flex items-center text-xs text-slate-500 dark:text-slate-400">
          {activeTypers.length > 0 && (
            <span>
              {activeTypers.map((t) => t.username).join(', ')}{' '}
              {activeTypers.length === 1 ? 'is' : 'are'} typing...
            </span>
          )}
        </div>

        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0 text-slate-600 dark:text-slate-400 truncate">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                Replying to {replyingTo.senderName}:{' '}
              </span>
              {replyingTo.text}
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
              aria-label="Cancel reply"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors"
        >
          {emojiOpen && (
            <div className="absolute bottom-14 left-2 z-20 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg grid grid-cols-6 gap-1">
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Insert emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              room
                ? `Message ${room.name}...`
                : 'Select or create a room to start chatting'
            }
            disabled={!room}
            className="flex-1 max-h-36 resize-none bg-transparent py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!room || !draft.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
