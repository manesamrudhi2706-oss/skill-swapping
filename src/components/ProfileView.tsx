import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type {
  AvailabilityStatus,
  DeveloperProject,
  SkillTier,
  SwapSession,
  UserProfile,
} from '../types/sigma.ts';
import { SKILL_CATALOG, SKILL_TIERS } from '../data/presets.ts';

interface ProfileViewProps {
  profile: UserProfile;
  swaps: SwapSession[];
  onSave: (updated: UserProfile) => Promise<void>;
}

export function ProfileView({ profile, swaps, onSave }: ProfileViewProps) {
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [customOffer, setCustomOffer] = useState('');
  const [customSeek, setCustomSeek] = useState('');
  const [projName, setProjName] = useState('');
  const [projStack, setProjStack] = useState('');
  const [projLevel, setProjLevel] = useState<DeveloperProject['level']>('Starter');
  const [projSummary, setProjSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const completedSwaps = swaps.filter((s) => s.status === 'completed');
  const netBalance = Number((profile.hoursTaught - profile.hoursLearned).toFixed(1));

  const toggleSkill = (field: 'offers' | 'seeks', skill: string) => {
    setDraft((prev) => {
      const exists = prev[field].includes(skill);
      const nextList = exists
        ? prev[field].filter((s) => s !== skill)
        : [...prev[field], skill];
      return { ...prev, [field]: nextList };
    });
  };

  const addCustomSkill = (field: 'offers' | 'seeks', value: string, reset: () => void) => {
    const clean = value.trim();
    if (!clean) return;
    setDraft((prev) => {
      if (prev[field].some((s) => s.toLowerCase() === clean.toLowerCase())) return prev;
      return { ...prev, [field]: [...prev[field], clean] };
    });
    reset();
  };

  const handleAddProject = () => {
    if (!projName.trim()) return;
    const newProject: DeveloperProject = {
      id: `proj_${Date.now()}`,
      name: projName.trim(),
      summary: projSummary.trim() || 'Built and tested during skill-swap practice.',
      stack: projStack
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      level: projLevel,
    };
    setDraft((prev) => ({
      ...prev,
      projects: [newProject, ...(prev.projects || [])],
    }));
    setProjName('');
    setProjStack('');
    setProjSummary('');
  };

  const handleRemoveProject = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((p) => p.id !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleaned: UserProfile = {
        ...draft,
        name: draft.name.trim() || profile.name,
        handle: draft.handle.trim().startsWith('@')
          ? draft.handle.trim()
          : `@${draft.handle.trim() || 'dev'}`,
        role: draft.role.trim() || 'Developer',
      };
      setDraft(cleaned);
      await onSave(cleaned);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Profile, Projects &amp; Skill Matrix
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your profile is saved to your private account. Your skills and projects help matched peers discover you in the directory.
        </p>
      </div>

      {/* Exchange Ledger Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Hours Taught</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {profile.hoursTaught}h
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Hours Learned</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {profile.hoursLearned}h
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Credit Balance</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {netBalance >= 0 ? `+${netBalance}h` : `${netBalance}h`}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Completed Swaps</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {completedSwaps.length}
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Account Identity
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {profile.email}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Handle
              </label>
              <input
                type="text"
                value={draft.handle}
                onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Role
              </label>
              <input
                type="text"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Level
                </label>
                <select
                  value={draft.skillTier}
                  onChange={(e) =>
                    setDraft({ ...draft, skillTier: e.target.value as SkillTier })
                  }
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                >
                  {SKILL_TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Timezone
                </label>
                <input
                  type="text"
                  value={draft.timezone}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Status
                </label>
                <select
                  value={draft.availability}
                  onChange={(e) =>
                    setDraft({ ...draft, availability: e.target.value as AvailabilityStatus })
                  }
                  className="w-full px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                >
                  <option value="Available now">Available now</option>
                  <option value="Open this week">Open this week</option>
                  <option value="In session">In session</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Short Bio
            </label>
            <textarea
              rows={2}
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>
        </section>

        {/* Your Projects */}
        <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Your Projects ({(draft.projects || []).length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              List starter exercises, side projects, or production systems you have built so partners see your journey.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="Project name (e.g. Habit CLI)"
              className="sm:col-span-4 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={projStack}
              onChange={(e) => setProjStack(e.target.value)}
              placeholder="Stack (e.g. Python, SQLite)"
              className="sm:col-span-4 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <select
              value={projLevel}
              onChange={(e) => setProjLevel(e.target.value as DeveloperProject['level'])}
              className="sm:col-span-2 px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="Starter">Starter</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Production">Production</option>
              <option value="Systems">Systems</option>
            </select>
            <button
              type="button"
              onClick={handleAddProject}
              disabled={!projName.trim()}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          <input
            type="text"
            value={projSummary}
            onChange={(e) => setProjSummary(e.target.value)}
            placeholder="One-line summary of what it does..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />

          {(draft.projects || []).length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
              {(draft.projects || []).map((p) => (
                <div key={p.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {p.name}{' '}
                      <span className="font-mono font-normal text-slate-500">
                        · {p.stack.join(' · ') || 'General'} · {p.level}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{p.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Skills Offered & Sought */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Skills You Offer (Teach)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select domains you can confidently guide another engineer through.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...SKILL_CATALOG, ...draft.offers])).map((skill) => {
                const active = draft.offers.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill('offers', skill)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={customOffer}
                onChange={(e) => setCustomOffer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSkill('offers', customOffer, () => setCustomOffer(''));
                  }
                }}
                placeholder="Add custom skill..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
              <button
                type="button"
                onClick={() => addCustomSkill('offers', customOffer, () => setCustomOffer(''))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Skills You Seek (Learn)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Topics you want to pair on and level up in during upcoming sessions.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...SKILL_CATALOG, ...draft.seeks])).map((skill) => {
                const active = draft.seeks.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill('seeks', skill)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={customSeek}
                onChange={(e) => setCustomSeek(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSkill('seeks', customSeek, () => setCustomSeek(''));
                  }
                }}
                placeholder="Add custom skill..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
              <button
                type="button"
                onClick={() => addCustomSkill('seeks', customSeek, () => setCustomSeek(''))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              Saved to your private account
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Profile & Recalculate Matches'}
          </button>
        </div>
      </form>
    </div>
  );
}
