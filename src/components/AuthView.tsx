import { useState } from 'react';
import { Eye, EyeOff, Lock, Moon, Sun } from 'lucide-react';
import type { SkillTier, UserProfile } from '../types/sigma.ts';
import { SKILL_CATALOG, SKILL_TIERS } from '../data/presets.ts';
import { setAuthToken } from '../lib/api.ts';
import { Avatar } from './Avatar.tsx';

interface AuthViewProps {
  darkMode: boolean;
  onToggleTheme: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

type AuthMode = 'login' | 'register';

const PREVIEW_PROFILES = [
  {
    name: 'Lucas Morales',
    tier: 'Beginner · 4 mos coding',
    avatar: '/src/assets/images/avatar_dev_lucas_1794908332267.jpg',
    skills: 'HTML & CSS · JavaScript · Git',
    projects: 'Markdown Habit Tracker · CLI Pomodoro Timer · Campus Book Swap Board',
  },
  {
    name: 'Devon Brooks',
    tier: 'Intermediate · 4 yrs exp',
    avatar: '/src/assets/images/avatar_dev_devon_1794908332824.jpg',
    skills: 'Node.js · PostgreSQL · Docker',
    projects: 'Multi-Tenant Webhook Relay · Idempotent Payment Guard · Docker DevKit',
  },
  {
    name: 'Hana Kim',
    tier: 'Principal · 12 yrs exp',
    avatar: '/src/assets/images/avatar_dev_hana_1794908334323.jpg',
    skills: 'Distributed Systems · Rust · Go',
    projects: 'Raft Consensus KV Engine · B-Tree Page Inspector · Online Schema Migrator',
  },
];

export function AuthView({ darkMode, onToggleTheme, onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(() => {
    try {
      return localStorage.getItem('sigma_has_account') === '1' ? 'login' : 'register';
    } catch {
      return 'register';
    }
  });

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('Full-Stack Developer');
  const [skillTier, setSkillTier] = useState<SkillTier>('Beginner');
  const [offers, setOffers] = useState<string[]>(['JavaScript', 'HTML & CSS']);
  const [seeks, setSeeks] = useState<string[]>(['TypeScript', 'React']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSkill = (list: 'offers' | 'seeks', skill: string) => {
    const setter = list === 'offers' ? setOffers : setSeeks;
    setter((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill].slice(0, 8)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              email,
              password,
              name,
              handle,
              role,
              skillTier,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              offers,
              seeks,
            }
          : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { user?: UserProfile; token?: string; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || 'Authentication failed. Please check your details.');
        return;
      }

      if (data.token) {
        setAuthToken(data.token);
      }
      try {
        localStorage.setItem('sigma_has_account', '1');
      } catch {
        // Ignore storage errors
      }
      onAuthenticated(data.user);
    } catch {
      setError('Unable to connect to the Sigma server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || 'alex.rivera@sigma.dev',
          password: password || '',
        }),
      });
      const data = (await res.json()) as { user?: UserProfile; token?: string; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || 'Unable to sign in.');
        return;
      }
      if (data.token) setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch {
      setError('Unable to connect to the Sigma server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Minimal Header */}
      <header className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-8">
        <span className="text-xl font-bold tracking-tight font-display text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0">
          Sigma
        </span>
        <div className="flex items-center gap-4 shrink-0">
          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Developer Skill Exchange &amp; Private Pair Studio
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle light or dark theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main 2-Column Split */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Value, Privacy Guarantee & Noob-to-Pro Community Preview */}
        <section className="lg:col-span-6 space-y-8">
          <div className="space-y-3 max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
              Private workspaces for real-time peer coding
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Create your account to keep your code rooms, swap proposals, and session notes strictly private to you—and invite partners only when you are ready to pair.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Account-isolated privacy by default</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your private sandboxes, execution logs, and swap history are scoped to your authenticated session. Only rooms you explicitly share via invite link are accessible to your pairing partner.
            </p>
          </div>

          {/* Real developers from Beginner to Principal */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Engineers across every stage — beginner to principal
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                9 active mentors &amp; peers
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {PREVIEW_PROFILES.map((item) => (
                <div key={item.name} className="p-4 flex items-start gap-3.5">
                  <Avatar src={item.avatar} name={item.name} sizeClass="w-11 h-11" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {item.tier}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {item.skills}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Projects: {item.projects}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Login / Create Account Form */}
        <section className="lg:col-span-6">
          <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Developer Handle
                      </label>
                      <input
                        type="text"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="@alexdev"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Experience Level
                      </label>
                      <select
                        value={skillTier}
                        onChange={(e) => setSkillTier(e.target.value as SkillTier)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      >
                        {SKILL_TIERS.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.label} — {tier.hint.split('·')[0].trim()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Current Role or Focus
                      </label>
                      <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Self-Taught / Backend / Student"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password <span className="font-normal text-slate-400">(optional in local mode)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional — leave blank or enter any password"
                    className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Skills You Can Share ({offers.length} selected)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SKILL_CATALOG.slice(0, 12).map((skill) => {
                        const active = offers.includes(skill);
                        return (
                          <button
                            key={`offer-${skill}`}
                            type="button"
                            onClick={() => toggleSkill('offers', skill)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Skills You Want to Learn ({seeks.length} selected)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SKILL_CATALOG.slice(0, 12).map((skill) => {
                        const active = seeks.includes(skill);
                        return (
                          <button
                            key={`seek-${skill}`}
                            type="button"
                            onClick={() => toggleSkill('seeks', skill)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              active
                                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                                : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting
                  ? mode === 'register'
                    ? 'Creating private workspace...'
                    : 'Signing in...'
                  : mode === 'register'
                    ? 'Create Account & Enter Workspace'
                    : 'Sign In to Workspace'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleQuickDemoSignIn}
                className="w-full py-2 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Quick Enter Workspace (No Password Required)
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
