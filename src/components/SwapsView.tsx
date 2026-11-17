import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Lock, Plus, Users, X } from 'lucide-react';
import type { LanguageId, SwapSession, SwapStatus } from '../types/sigma.ts';
import { CHALLENGE_PRESETS, LANGUAGE_LABELS } from '../data/presets.ts';

interface SwapsViewProps {
  swaps: SwapSession[];
  onEnterRoom: (roomId: string) => void;
  onUpdateStatus: (swapId: string, status: SwapStatus) => Promise<void>;
  onCreateOpenRoom: (payload: {
    title: string;
    language: LanguageId;
    presetId: string;
    isPrivate: boolean;
  }) => Promise<void>;
}

export function SwapsView({
  swaps,
  onEnterRoom,
  onUpdateStatus,
  onCreateOpenRoom,
}: SwapsViewProps) {
  const [filter, setFilter] = useState<'all' | SwapStatus>('all');
  const [roomTitle, setRoomTitle] = useState('Live TypeScript & Architecture Pairing');
  const [roomPresetId, setRoomPresetId] = useState(CHALLENGE_PRESETS[0].id);
  const [isPrivateRoom, setIsPrivateRoom] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filteredSwaps = useMemo(() => {
    if (filter === 'all') return swaps;
    return swaps.filter((s) => s.status === filter);
  }, [swaps, filter]);

  const handleCopyLink = (roomId: string) => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const preset = CHALLENGE_PRESETS.find((p) => p.id === roomPresetId) || CHALLENGE_PRESETS[0];
    setCreating(true);
    try {
      await onCreateOpenRoom({
        title: roomTitle.trim() || preset.title,
        language: preset.language,
        presetId: preset.id,
        isPrivate: isPrivateRoom,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (clean) {
      onEnterRoom(clean);
      setJoinCode('');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Your Private Swaps &amp; Rooms
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Only exchanges and workspaces belonging to your account appear here. Create a private solo sandbox or an invite-only pair room.
          </p>
        </div>

        <form onSubmit={handleJoinByCode} className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Invite room code (e.g. SIGMA-4A2B)"
            aria-label="Join by room code"
            className="w-56 px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Join Room
          </button>
        </form>
      </div>

      {/* Create Instant Room */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Launch a Workspace Room
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Keep your draft strictly private to your account, or make it an invite-link room for live pair programming.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setIsPrivateRoom(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                isPrivateRoom
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Private (Only You)
            </button>
            <button
              type="button"
              onClick={() => setIsPrivateRoom(false)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                !isPrivateRoom
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Pair Invite Link
            </button>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="text"
            value={roomTitle}
            onChange={(e) => setRoomTitle(e.target.value)}
            placeholder="Session topic or debugging goal..."
            aria-label="Open room title"
            className="md:col-span-6 px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
          <select
            value={roomPresetId}
            onChange={(e) => setRoomPresetId(e.target.value)}
            aria-label="Starter template"
            className="md:col-span-4 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          >
            {CHALLENGE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {LANGUAGE_LABELS[preset.language]} · {preset.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating}
            className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Room
          </button>
        </form>
      </section>

      {/* Swap Sessions List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Your Exchanges &amp; Sandboxes
          </h2>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'pending', label: 'Pending' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredSwaps.length === 0 ? (
          <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-sm text-slate-500 dark:text-slate-400">
            No private swaps or sandboxes match this filter yet. Propose a swap from the Skill Directory or create a room above.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {filteredSwaps.map((swap) => (
              <div
                key={swap.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {swap.title}
                    </h3>
                    <span
                      className={`text-xs font-medium ${
                        swap.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : swap.status === 'pending'
                            ? 'text-amber-700 dark:text-amber-400'
                            : swap.status === 'completed'
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {swap.isPrivate ? 'Private' : 'Pair Invite'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    <span>
                      {swap.requesterName} ({swap.requesterHandle}) ↔ {swap.partnerName} ({swap.partnerHandle})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {swap.offerSkill} / {swap.seekSkill}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{swap.durationMinutes}m</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{swap.roomId}</span>
                  </div>

                  {swap.goalNotes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-2xl">
                      {swap.goalNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!swap.isPrivate && (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(swap.roomId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === swap.roomId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Invite
                        </>
                      )}
                    </button>
                  )}

                  {swap.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(swap.id, 'declined')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:text-red-600 hover:border-red-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateStatus(swap.id, 'active');
                          onEnterRoom(swap.roomId);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Accept &amp; Pair
                      </button>
                    </>
                  )}

                  {swap.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(swap.id, 'completed')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => onEnterRoom(swap.roomId)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Enter Studio
                      </button>
                    </>
                  )}

                  {swap.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => onEnterRoom(swap.roomId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open Code Snapshot
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
