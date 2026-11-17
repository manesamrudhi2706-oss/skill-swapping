import { useMemo, useState } from 'react';
import { Search, ArrowRightLeft, SlidersHorizontal, Play, ChevronDown, ChevronUp } from 'lucide-react';
import type { DeveloperProfile, UserProfile } from '../types/sigma.ts';
import { SKILL_CATALOG } from '../data/presets.ts';
import { Avatar } from './Avatar.tsx';

interface DirectoryViewProps {
  developers: DeveloperProfile[];
  userProfile: UserProfile;
  loading: boolean;
  onProposeSwap: (dev: DeveloperProfile) => void;
  onQuickPair: (dev: DeveloperProfile) => void;
  onEditProfile: () => void;
}

type FilterMode = 'all' | 'mutual' | 'available';
type TierFilter = 'all' | 'starter' | 'intermediate' | 'pro';

export function DirectoryView({
  developers,
  userProfile,
  loading,
  onProposeSwap,
  onQuickPair,
  onEditProfile,
}: DirectoryViewProps) {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const computeMatch = (dev: DeveloperProfile) => {
    const theyOfferWhatYouSeek = dev.offers.filter((s) =>
      userProfile.seeks.some((u) => u.toLowerCase() === s.toLowerCase())
    );
    const youOfferWhatTheySeek = dev.seeks.filter((s) =>
      userProfile.offers.some((u) => u.toLowerCase() === s.toLowerCase())
    );
    return {
      isMutual: theyOfferWhatYouSeek.length > 0 && youOfferWhatTheySeek.length > 0,
      theyTeach: theyOfferWhatYouSeek,
      youTeach: youOfferWhatTheySeek,
    };
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return developers.filter((dev) => {
      const match = computeMatch(dev);
      if (filterMode === 'mutual' && !match.isMutual) return false;
      if (filterMode === 'available' && dev.availability !== 'Available now') return false;

      if (tierFilter === 'starter' && dev.skillTier !== 'Beginner' && dev.skillTier !== 'Junior') {
        return false;
      }
      if (tierFilter === 'intermediate' && dev.skillTier !== 'Intermediate') {
        return false;
      }
      if (tierFilter === 'pro' && dev.skillTier !== 'Senior' && dev.skillTier !== 'Principal') {
        return false;
      }

      if (
        skillFilter !== 'all' &&
        !dev.offers.some((s) => s.toLowerCase() === skillFilter.toLowerCase()) &&
        !dev.seeks.some((s) => s.toLowerCase() === skillFilter.toLowerCase())
      ) {
        return false;
      }

      if (!q) return true;
      const haystack = [
        dev.name,
        dev.handle,
        dev.role,
        dev.skillTier,
        dev.activeTopic,
        dev.bio,
        ...dev.offers,
        ...dev.seeks,
        ...dev.projects.map((p) => `${p.name} ${p.summary} ${p.stack.join(' ')}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [developers, userProfile, query, filterMode, tierFilter, skillFilter]);

  const toggleExpand = (devId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [devId]: !prev[devId] }));
  };

  return (
    <div className="space-y-6">
      {/* Page header & match baseline */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
            Exchange engineering expertise through live pairing
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Browse builders from first-project beginners to principal systems architects, review their shipped projects, and pair in a private live studio.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Signed in as {userProfile.handle} · {userProfile.skillTier}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
            <span>
              Offers: {userProfile.offers.length > 0 ? userProfile.offers.join(' · ') : 'None set'}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>
            <span>
              Seeks: {userProfile.seeks.length > 0 ? userProfile.seeks.join(' · ') : 'None set'}
            </span>
            <button
              type="button"
              onClick={onEditProfile}
              className="font-sans font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Edit skills
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by engineer, skill, or project..."
            aria-label="Search developers and projects"
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Experience Tier Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Levels' },
                { id: 'starter', label: 'Beginner / Junior' },
                { id: 'intermediate', label: 'Intermediate' },
                { id: 'pro', label: 'Senior / Pro' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTierFilter(tab.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tierFilter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Match & Availability Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Everyone' },
                { id: 'mutual', label: 'Mutual Match' },
                { id: 'available', label: 'Available Now' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              aria-label="Filter by skill"
              className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            >
              <option value="all">All Skills</option>
              {SKILL_CATALOG.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded" />
              <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No matching developers found
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Try resetting your level or skill filters to view all engineers from Beginner to Principal.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilterMode('all');
              setTierFilter('all');
              setSkillFilter('all');
            }}
            className="px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Developer Cards Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((dev) => {
            const match = computeMatch(dev);
            const isExpanded = Boolean(expandedProjects[dev.id]);
            const visibleProjects = isExpanded ? dev.projects : dev.projects.slice(0, 2);

            return (
              <article
                key={dev.id}
                className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar src={dev.avatarUrl} name={dev.name} sizeClass="w-12 h-12" />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
                            {dev.name}
                          </h2>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                            {dev.handle}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                          {dev.role}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-medium whitespace-nowrap ${
                          dev.availability === 'Available now'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {dev.availability}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {dev.skillTier} · {dev.experienceLabel}
                      </div>
                    </div>
                  </div>

                  {/* Mutual match indicator */}
                  {match.isMutual && (
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-400">
                      Mutual match · You teach {match.youTeach[0]} in exchange for {match.theyTeach[0]}
                    </div>
                  )}

                  {/* Bio */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {dev.bio}
                  </p>

                  {/* Skill Exchange Rows */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0 w-16">
                        Offers
                      </span>
                      <span className="font-mono text-slate-900 dark:text-slate-100 text-right">
                        {dev.offers.join(' · ')}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0 w-16">
                        Seeks
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 text-right">
                        {dev.seeks.join(' · ')}
                      </span>
                    </div>
                  </div>

                  {/* Projects Portfolio (Noob to Pro Builds) */}
                  {dev.projects.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Built Projects ({dev.projects.length})
                        </span>
                        {dev.projects.length > 2 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(dev.id)}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                Show fewer <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                View all {dev.projects.length} <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {visibleProjects.map((proj) => (
                          <div key={proj.id} className="text-xs space-y-0.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {proj.name}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {proj.stack.join(' · ')} · {proj.level}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 leading-snug">
                              {proj.summary}
                              {proj.metrics ? ` (${proj.metrics})` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer metadata & actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{dev.completedSwaps} swaps</span>
                    <span aria-hidden="true">·</span>
                    <span>{dev.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dev.timezone}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onQuickPair(dev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Quick Pair
                    </button>
                    <button
                      type="button"
                      onClick={() => onProposeSwap(dev)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Propose Swap
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
