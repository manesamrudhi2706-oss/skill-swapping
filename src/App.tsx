import { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Code2,
  Compass,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  DeveloperProfile,
  LanguageId,
  SwapSession,
  SwapStatus,
  UserProfile,
} from './types/sigma.ts';
import { CHALLENGE_PRESETS } from './data/presets.ts';
import { apiFetch, setAuthToken } from './lib/api.ts';
import { AuthView } from './components/AuthView.tsx';
import { DirectoryView } from './components/DirectoryView.tsx';
import { SwapsView } from './components/SwapsView.tsx';
import { PairStudioView } from './components/PairStudioView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { SwapProposalModal } from './components/SwapProposalModal.tsx';

type NavView = 'directory' | 'swaps' | 'studio' | 'profile';

function getTabClientId(): string {
  const key = 'sigma_tab_client_id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  sessionStorage.setItem(key, created);
  return created;
}

export default function App() {
  const [clientId] = useState<string>(() => getTabClientId());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sigma_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const initialRoomParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase() || ''
      : '';

  const [activeView, setActiveView] = useState<NavView>(
    initialRoomParam ? 'studio' : 'directory'
  );
  const [activeRoomId, setActiveRoomId] = useState<string>(initialRoomParam);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [developers, setDevelopers] = useState<DeveloperProfile[]>([]);
  const [swaps, setSwaps] = useState<SwapSession[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proposalPartner, setProposalPartner] = useState<DeveloperProfile | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('sigma_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('sigma_theme', 'light');
    }
  }, [darkMode]);

  // Verify active authenticated session on boot
  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) {
          setAuthToken(null);
          return null;
        }
        const data = (await res.json()) as { user?: UserProfile };
        return data.user || null;
      })
      .then((user) => {
        if (!active) return;
        setUserProfile(user);
      })
      .catch(() => {
        if (active) setUserProfile(null);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchPlatformData = async () => {
    setLoadingData(true);
    setLoadError(null);
    try {
      const [devRes, swapRes] = await Promise.all([
        apiFetch('/api/developers'),
        apiFetch('/api/swaps'),
      ]);
      if (devRes.status === 401 || swapRes.status === 401) {
        setAuthToken(null);
        setUserProfile(null);
        return;
      }
      if (!devRes.ok || !swapRes.ok) {
        throw new Error('Failed to load workspace data');
      }
      const devData = (await devRes.json()) as { developers: DeveloperProfile[] };
      const swapData = (await swapRes.json()) as { swaps: SwapSession[] };
      setDevelopers(devData.developers || []);
      const loadedSwaps = swapData.swaps || [];
      setSwaps(loadedSwaps);
      if (!activeRoomId && loadedSwaps[0]?.roomId) {
        setActiveRoomId(loadedSwaps[0].roomId);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach Sigma API');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchPlatformData();
    }
  }, [userProfile?.id]);

  const syncRoomUrl = (roomId: string | null) => {
    const url = new URL(window.location.href);
    if (roomId) {
      url.searchParams.set('room', roomId);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const openStudioRoom = (roomId: string) => {
    const clean = roomId.trim().toUpperCase();
    if (!clean) return;
    setActiveRoomId(clean);
    setActiveView('studio');
    setMobileNavOpen(false);
    syncRoomUrl(clean);
  };

  const navigateTo = (view: NavView) => {
    setActiveView(view);
    setMobileNavOpen(false);
    if (view === 'studio' && activeRoomId) {
      syncRoomUrl(activeRoomId);
    } else {
      syncRoomUrl(null);
    }
  };

  const handleSaveProfile = async (updated: UserProfile) => {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: UserProfile };
      setUserProfile(data.user);
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthToken(null);
    setUserProfile(null);
    setSwaps([]);
    setDevelopers([]);
    syncRoomUrl(null);
  };

  const handleProposeSubmit = async (payload: {
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
  }) => {
    const res = await apiFetch('/api/swaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        partnerId: payload.partner.id,
        partnerName: payload.partner.name,
        partnerHandle: payload.partner.handle,
        offerSkill: payload.offerSkill,
        seekSkill: payload.seekSkill,
        durationMinutes: payload.durationMinutes,
        goalNotes: payload.goalNotes,
        language: payload.language,
        starterCode: payload.starterCode,
        starterFileName: payload.starterFileName,
        checklist: payload.checklist,
        immediateActive: payload.immediateActive,
        isPrivate: false,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { swap: SwapSession };
      setSwaps((prev) => [data.swap, ...prev]);
      setProposalPartner(null);
      if (payload.immediateActive) {
        openStudioRoom(data.swap.roomId);
      } else {
        navigateTo('swaps');
      }
    }
  };

  const handleQuickPair = async (partner: DeveloperProfile) => {
    if (!userProfile) return;
    const matchedOffer =
      partner.seeks.find((s) => userProfile.offers.includes(s)) ||
      userProfile.offers[0] ||
      'JavaScript';
    const matchedSeek = partner.offers[0] || 'System Design';
    const preset =
      CHALLENGE_PRESETS.find((p) => p.language === partner.preferredLanguage) ||
      CHALLENGE_PRESETS[0];

    await handleProposeSubmit({
      partner,
      title: `${matchedOffer} ↔ ${matchedSeek} with ${partner.name.split(' ')[0]}`,
      offerSkill: matchedOffer,
      seekSkill: matchedSeek,
      durationMinutes: 45,
      goalNotes: `Quick pair on ${partner.activeTopic}`,
      language: preset.language,
      starterCode: preset.code,
      starterFileName: preset.fileName,
      checklist: preset.checklist,
      immediateActive: true,
    });
  };

  const handleUpdateSwapStatus = async (swapId: string, status: SwapStatus) => {
    const res = await apiFetch(`/api/swaps/${encodeURIComponent(swapId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = (await res.json()) as { swap: SwapSession; user?: UserProfile };
      setSwaps((prev) => prev.map((s) => (s.id === swapId ? data.swap : s)));
      if (data.user) setUserProfile(data.user);
    }
  };

  const handleCreateOpenRoom = async (payload: {
    title: string;
    language: LanguageId;
    presetId: string;
    isPrivate: boolean;
  }) => {
    const preset =
      CHALLENGE_PRESETS.find((p) => p.id === payload.presetId) || CHALLENGE_PRESETS[0];
    const res = await apiFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        language: preset.language,
        fileName: preset.fileName,
        code: preset.code,
        checklist: preset.checklist,
        isPrivate: payload.isPrivate,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { room: { roomId: string } };
      openStudioRoom(data.room.roomId);
    }
  };

  const handleCompleteSwapRoom = async (roomId: string) => {
    const linked = swaps.find((s) => s.roomId === roomId && s.status !== 'completed');
    if (linked) {
      await handleUpdateSwapStatus(linked.id, 'completed');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading Sigma workspace...
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <AuthView
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        onAuthenticated={(user) => setUserProfile(user)}
      />
    );
  }

  const activeOrPendingCount = swaps.filter(
    (s) => s.status === 'active' || s.status === 'pending'
  ).length;

  const breadcrumbLabel =
    activeView === 'directory'
      ? 'Skill Directory'
      : activeView === 'swaps'
        ? 'Swaps & Rooms'
        : activeView === 'studio'
          ? `Pair Studio / ${activeRoomId || 'New'}`
          : 'Profile & Skills';

  const navItems: { id: NavView; label: string; icon: typeof Compass; count?: number }[] = [
    { id: 'directory', label: 'Skill Directory', icon: Compass },
    { id: 'swaps', label: 'Swaps & Rooms', icon: ArrowRightLeft, count: activeOrPendingCount },
    { id: 'studio', label: 'Pair Studio', icon: Code2 },
    { id: 'profile', label: 'Profile & Skills', icon: UserCheck },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="p-5 space-y-6">
          <button
            type="button"
            onClick={() => navigateTo('directory')}
            className="text-xl font-bold tracking-tight font-display text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sigma
          </button>

          <nav aria-label="Primary workspace navigation" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile, Theme & Sign Out */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button
            type="button"
            onClick={() => navigateTo('profile')}
            className="w-full text-left space-y-0.5 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {userProfile.name}
            </div>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
              {userProfile.handle} · {userProfile.skillTier}
            </div>
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Toggle light or dark theme"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-slate-950/50"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold font-display text-slate-900 dark:text-slate-50">
                  Sigma
                </span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateTo(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg ${
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="text-xs font-mono tabular-nums">{item.count}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              >
                <span>{darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap truncate">
              Sigma <span className="text-slate-400 mx-1">/</span> {breadcrumbLabel}
            </span>
          </div>

          <nav
            aria-label="Quick section links"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
          >
            <button
              type="button"
              onClick={() => navigateTo('directory')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'directory'
                  ? 'text-slate-900 dark:text-slate-50 underline underline-offset-4'
                  : ''
              }`}
            >
              Directory
            </button>
            <button
              type="button"
              onClick={() => navigateTo('swaps')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'swaps'
                  ? 'text-slate-900 dark:text-slate-50 underline underline-offset-4'
                  : ''
              }`}
            >
              Swaps
            </button>
            <button
              type="button"
              onClick={() => navigateTo('studio')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'studio'
                  ? 'text-slate-900 dark:text-slate-50 underline underline-offset-4'
                  : ''
              }`}
            >
              Pair Studio
            </button>
            <button
              type="button"
              onClick={() => navigateTo('profile')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'profile'
                  ? 'text-slate-900 dark:text-slate-50 underline underline-offset-4'
                  : ''
              }`}
            >
              Profile
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeView === 'studio') {
                  navigateTo('swaps');
                } else if (activeRoomId) {
                  openStudioRoom(activeRoomId);
                } else {
                  navigateTo('swaps');
                }
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeView === 'studio' ? 'All Rooms' : 'Open Pair Studio'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {loadError && (
            <div className="mb-4 p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 flex items-center justify-between gap-4 text-xs text-red-700 dark:text-red-300">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={fetchPlatformData}
                className="px-3 py-1.5 font-medium rounded-lg border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {activeView === 'directory' && (
            <DirectoryView
              developers={developers}
              userProfile={userProfile}
              loading={loadingData}
              onProposeSwap={(dev) => setProposalPartner(dev)}
              onQuickPair={handleQuickPair}
              onEditProfile={() => navigateTo('profile')}
            />
          )}

          {activeView === 'swaps' && (
            <SwapsView
              swaps={swaps}
              onEnterRoom={openStudioRoom}
              onUpdateStatus={handleUpdateSwapStatus}
              onCreateOpenRoom={handleCreateOpenRoom}
            />
          )}

          {activeView === 'studio' && activeRoomId && (
            <PairStudioView
              roomId={activeRoomId}
              userProfile={userProfile}
              clientId={clientId}
              onCompleteSwapRoom={handleCompleteSwapRoom}
              onBackToSwaps={() => navigateTo('swaps')}
            />
          )}

          {activeView === 'studio' && !activeRoomId && (
            <div className="p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                No room selected yet
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Launch a private sandbox or join an invite room from Swaps &amp; Rooms.
              </p>
              <button
                type="button"
                onClick={() => navigateTo('swaps')}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Go to Swaps &amp; Rooms
              </button>
            </div>
          )}

          {activeView === 'profile' && (
            <ProfileView
              profile={userProfile}
              swaps={swaps}
              onSave={handleSaveProfile}
            />
          )}
        </main>
      </div>

      <SwapProposalModal
        partner={proposalPartner}
        userProfile={userProfile}
        onClose={() => setProposalPartner(null)}
        onSubmit={handleProposeSubmit}
      />
    </div>
  );
}
