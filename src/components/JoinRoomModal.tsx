import React, { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  initialRoomCode?: string;
  initialRequiresPasscode?: boolean;
  initialError?: string;
  onClose: () => void;
  onJoin: (
    roomId: string,
    passcode?: string
  ) => Promise<{ ok: boolean; error?: string; requiresPasscode?: boolean }>;
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
    // Fallback to raw input
  }
  return trimmed;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  initialRoomCode = '',
  initialRequiresPasscode = false,
  initialError = '',
  onClose,
  onJoin,
}) => {
  const [roomInput, setRoomInput] = useState(initialRoomCode);
  const [passcode, setPasscode] = useState('');
  const [requiresPasscode, setRequiresPasscode] = useState(initialRequiresPasscode);
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRoomInput(initialRoomCode);
      setRequiresPasscode(initialRequiresPasscode);
      setError(initialError);
      setPasscode('');
    }
  }, [isOpen, initialRoomCode, initialRequiresPasscode, initialError]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomId = extractRoomCode(roomInput);
    if (!roomId) {
      setError('Enter a room code or paste an invite link.');
      return;
    }

    setError('');
    setSubmitting(true);
    const res = await onJoin(roomId, passcode);
    setSubmitting(false);

    if (!res.ok) {
      if (res.requiresPasscode) {
        setRequiresPasscode(true);
      }
      setError(res.error || 'Unable to join room.');
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-room-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="join-room-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Join Personal Room
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter a shared room code or paste an invite URL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="join-room-code"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Room code or invite URL
            </label>
            <input
              id="join-room-code"
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="e.g. study-group-4a1f"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="join-room-passcode"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Passcode{' '}
              <span className="text-slate-400 dark:text-slate-500 font-normal">
                {requiresPasscode ? '(required)' : '(if protected)'}
              </span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="join-room-passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter room passcode"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {submitting ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
