import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { DeveloperProfile, LanguageId, UserProfile } from '../types/sigma.ts';
import { CHALLENGE_PRESETS, SKILL_CATALOG } from '../data/presets.ts';
import { Avatar } from './Avatar.tsx';

interface SwapProposalModalProps {
  partner: DeveloperProfile | null;
  userProfile: UserProfile;
  onClose: () => void;
  onSubmit: (payload: {
    partner: DeveloperProfile;
    title: string;
    offerSkill: string;
    seekSkill: string;
    durationMinutes: number;
    goalNotes: string;
    language: LanguageId;
    starterCode?: string;
    starterFileName?: string;
    checklist?: string[];
    immediateActive: boolean;
  }) => Promise<void>;
}

export function SwapProposalModal({
  partner,
  userProfile,
  onClose,
  onSubmit,
}: SwapProposalModalProps) {
  const [offerSkill, setOfferSkill] = useState(userProfile.offers[0] || 'TypeScript');
  const [seekSkill, setSeekSkill] = useState(partner?.offers[0] || 'Rust');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [presetId, setPresetId] = useState(CHALLENGE_PRESETS[0].id);
  const [title, setTitle] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!partner) return;
    const defaultOffer =
      partner.seeks.find((s) => userProfile.offers.includes(s)) ||
      userProfile.offers[0] ||
      'TypeScript';
    const defaultSeek = partner.offers[0] || 'System Design';
    setOfferSkill(defaultOffer);
    setSeekSkill(defaultSeek);
    setTitle(`${defaultOffer} ↔ ${defaultSeek} with ${partner.name.split(' ')[0]}`);
    setGoalNotes(`Pair on ${partner.activeTopic.toLowerCase()} and trade feedback.`);

    const matchedPreset =
      CHALLENGE_PRESETS.find((p) => p.language === partner.preferredLanguage) ||
      CHALLENGE_PRESETS[0];
    setPresetId(matchedPreset.id);
  }, [partner, userProfile]);

  useEffect(() => {
    if (!partner) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [partner, onClose]);

  if (!partner) return null;

  const selectedPreset = CHALLENGE_PRESETS.find((p) => p.id === presetId) || CHALLENGE_PRESETS[0];
  const offerOptions = Array.from(new Set([...userProfile.offers, ...SKILL_CATALOG]));
  const seekOptions = Array.from(new Set([...partner.offers, ...SKILL_CATALOG]));

  const handleAction = async (immediateActive: boolean) => {
    setSubmitting(true);
    try {
      await onSubmit({
        partner,
        title: title.trim() || `${offerSkill} ↔ ${seekSkill} Pairing`,
        offerSkill,
        seekSkill,
        durationMinutes,
        goalNotes,
        language: selectedPreset.language,
        starterCode: selectedPreset.code,
        starterFileName: selectedPreset.fileName,
        checklist: selectedPreset.checklist,
        immediateActive,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={partner.avatarUrl} name={partner.name} sizeClass="w-10 h-10" />
            <div className="min-w-0">
              <h2
                id="swap-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-50 truncate"
              >
                Propose Skill Swap with {partner.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {partner.role} · {partner.timezone}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Session Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Skill You Will Teach
              </label>
              <select
                value={offerSkill}
                onChange={(e) => setOfferSkill(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              >
                {offerOptions.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Skill You Want to Learn
              </label>
              <select
                value={seekSkill}
                onChange={(e) => setSeekSkill(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              >
                {seekOptions.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Session Duration
              </label>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                {[30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md tabular-nums transition-colors cursor-pointer ${
                      durationMinutes === mins
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Workspace Starter Code
              </label>
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              >
                {CHALLENGE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Pairing Agenda & Goals
            </label>
            <textarea
              rows={3}
              value={goalNotes}
              onChange={(e) => setGoalNotes(e.target.value)}
              placeholder="What do you both want to accomplish during the session?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction(false)}
            className="px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            Send Proposal
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            Launch Live Studio Now
          </button>
        </div>
      </div>
    </div>
  );
}
