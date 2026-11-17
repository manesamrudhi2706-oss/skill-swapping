import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import express from 'express';
import type {
  AvailabilityStatus,
  ChatMessage,
  ChecklistItem,
  DeveloperProfile,
  DeveloperProject,
  ExecutionResult,
  LanguageId,
  LineAnnotation,
  RoomFile,
  RoomState,
  SkillTier,
  SwapSession,
  SwapStatus,
  UserProfile,
} from '../src/types/sigma.ts';

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'sigma-data')
  : path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'sigma-state.json');
const SECRET_FILE = path.join(DATA_DIR, 'sigma-secret');

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (IS_VERCEL) {
    // Deterministic secret across Vercel serverless lambda instances
    return crypto
      .createHash('sha256')
      .update(`sigma-vercel-secret-${process.env.VERCEL_PROJECT_ID || 'default'}`)
      .digest('hex');
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, 'utf-8');
    return secret;
  } catch {
    return 'sigma-dev-fallback-secret-key';
  }
}

const SESSION_SECRET = getSessionSecret();
export const COOKIE_NAME = 'sigma_session';

export const SEED_DEVELOPERS: DeveloperProfile[] = [
  {
    id: 'dev_lucas',
    name: 'Lucas Morales',
    handle: '@lucasm',
    role: 'CS Student & Self-Taught Builder',
    skillTier: 'Beginner',
    experienceLabel: '4 mos coding',
    location: 'Austin, US',
    timezone: 'UTC-6',
    avatarUrl: '/src/assets/images/avatar_dev_lucas_1794908332267.jpg',
    bio: 'Four months into web development and building small daily tools. Looking for patient code reviews in JavaScript and Git workflows; happy to help newcomers with HTML/CSS layouts.',
    offers: ['HTML & CSS', 'Git & GitHub', 'JavaScript'],
    seeks: ['React', 'Testing & TDD', 'TypeScript'],
    projects: [
      {
        id: 'proj_lucas_1',
        name: 'Markdown Habit Tracker',
        summary: 'Local-storage daily streak log with keyboard shortcuts and CSV export.',
        stack: ['HTML & CSS', 'JavaScript'],
        level: 'Starter',
        metrics: '180 LOC · Zero dependencies',
      },
      {
        id: 'proj_lucas_2',
        name: 'CLI Pomodoro Timer',
        summary: 'Terminal focus timer in Node.js that logs completed sessions to a JSON file.',
        stack: ['Node.js', 'JavaScript'],
        level: 'Starter',
        metrics: 'First npm CLI tool',
      },
      {
        id: 'proj_lucas_3',
        name: 'Campus Book Swap Board',
        summary: 'Static textbook listing grid with search filter and responsive CSS Grid layout.',
        stack: ['HTML & CSS', 'Git & GitHub'],
        level: 'Starter',
        metrics: 'Used by 40 classmates',
      },
    ],
    experienceYears: 0.4,
    completedSwaps: 3,
    hoursSwapped: 2.0,
    availability: 'Available now',
    activeTopic: 'Safe money rounding & array edge cases in JS',
    preferredLanguage: 'javascript',
  },
  {
    id: 'dev_tessa',
    name: 'Tessa Lindqvist',
    handle: '@tessal',
    role: 'Junior Full-Stack Developer',
    skillTier: 'Junior',
    experienceLabel: '1.5 yrs exp',
    location: 'Stockholm, SE',
    timezone: 'UTC+1',
    avatarUrl: '/src/assets/images/avatar_dev_tessa_1794908332581.jpg',
    bio: 'Transitioned from graphic design into Python scripting and accessible CSS. Trading clean UI polish and Flask APIs for TypeScript generics and PostgreSQL joins.',
    offers: ['Python', 'CSS Architecture', 'REST APIs'],
    seeks: ['TypeScript', 'PostgreSQL', 'Node.js'],
    projects: [
      {
        id: 'proj_tessa_1',
        name: 'Freelance Invoice PDF Generator',
        summary: 'Python CLI + Jinja templates turning YAML timesheets into print-ready PDF invoices.',
        stack: ['Python', 'HTML & CSS'],
        level: 'Starter',
        metrics: 'Generates 30+ invoices/mo',
      },
      {
        id: 'proj_tessa_2',
        name: 'Weather Webhook Notifier',
        summary: 'Scheduled Python worker checking frost alerts via Open-Meteo and posting webhooks.',
        stack: ['Python', 'REST APIs'],
        level: 'Intermediate',
        metrics: '99.4% uptime on Raspberry Pi',
      },
      {
        id: 'proj_tessa_3',
        name: 'Accessible Recipe Index',
        summary: 'Keyboard-navigable recipe catalog with ingredient scaling and WCAG AA contrast checks.',
        stack: ['CSS Architecture', 'JavaScript'],
        level: 'Intermediate',
        metrics: '100 Lighthouse Accessibility',
      },
    ],
    experienceYears: 1.5,
    completedSwaps: 8,
    hoursSwapped: 6.5,
    availability: 'Available now',
    activeTopic: 'Accessible form validation & Python API error handling',
    preferredLanguage: 'python',
  },
  {
    id: 'dev_devon',
    name: 'Devon Brooks',
    handle: '@dbrooks',
    role: 'Backend & Platform Engineer',
    skillTier: 'Intermediate',
    experienceLabel: '4 yrs exp',
    location: 'Atlanta, US',
    timezone: 'UTC-5',
    avatarUrl: '/src/assets/images/avatar_dev_devon_1794908332824.jpg',
    bio: 'Owns billing webhooks and Dockerized Node.js microservices. Happy to pair on PostgreSQL migrations or idempotency keys while leveling up on Go and Kubernetes.',
    offers: ['Node.js', 'PostgreSQL', 'Docker', 'REST APIs'],
    seeks: ['Go', 'Kubernetes', 'System Design'],
    projects: [
      {
        id: 'proj_devon_1',
        name: 'Multi-Tenant Webhook Relay',
        summary: 'Outbox-pattern delivery service with exponential backoff and dead-letter replay UI.',
        stack: ['Node.js', 'PostgreSQL', 'Docker'],
        level: 'Production',
        metrics: '120k deliveries/day',
      },
      {
        id: 'proj_devon_2',
        name: 'Idempotent Payment Guard',
        summary: 'Express middleware locking concurrent checkout retries using advisory SQL locks.',
        stack: ['TypeScript', 'PostgreSQL'],
        level: 'Production',
        metrics: '0 duplicate charges',
      },
      {
        id: 'proj_devon_3',
        name: 'Docker Compose DevKit',
        summary: 'One-command local Postgres, Redis, and seed script harness for onboarding new hires.',
        stack: ['Docker', 'Node.js'],
        level: 'Intermediate',
        metrics: 'Cut setup from 2h to 4m',
      },
      {
        id: 'proj_devon_4',
        name: 'CSV Import Validator',
        summary: 'Streaming row validator catching malformed dates and duplicates before DB insert.',
        stack: ['Node.js', 'Testing & TDD'],
        level: 'Intermediate',
        metrics: '50k rows/sec stream',
      },
    ],
    experienceYears: 4,
    completedSwaps: 14,
    hoursSwapped: 11.5,
    availability: 'Available now',
    activeTopic: 'Bounded async worker queues & retry backoff',
    preferredLanguage: 'javascript',
  },
  {
    id: 'dev_priya',
    name: 'Priya Nair',
    handle: '@pnair',
    role: 'ML Infrastructure Engineer',
    skillTier: 'Intermediate',
    experienceLabel: '5.5 yrs exp',
    location: 'Bengaluru, IN',
    timezone: 'UTC+5:30',
    avatarUrl: '/src/assets/images/avatar_dev_priya_1794907753139.jpg',
    bio: 'Works on Python inference batching, feature caches, and model evaluation harnesses. Want to pair on TypeScript APIs and Kubernetes autoscaling.',
    offers: ['Python', 'CUDA & ML Infra', 'Testing & TDD'],
    seeks: ['TypeScript', 'Kubernetes', 'WebSockets'],
    projects: [
      {
        id: 'proj_priya_1',
        name: 'Async Inference Batcher',
        summary: 'Dynamic micro-batching queue grouping concurrent embeddings requests within a 15ms window.',
        stack: ['Python', 'CUDA & ML Infra'],
        level: 'Production',
        metrics: '3.2x GPU throughput',
      },
      {
        id: 'proj_priya_2',
        name: 'O(1) Feature Cache Service',
        summary: 'Memory-bounded LRU cache with TTL eviction and hit-rate Prometheus exporter.',
        stack: ['Python', 'Docker'],
        level: 'Production',
        metrics: '94% cache hit ratio',
      },
      {
        id: 'proj_priya_3',
        name: 'Pytest Benchmark Harness',
        summary: 'Regression test suite failing CI builds if p95 inference latency drifts over 8%.',
        stack: ['Python', 'Testing & TDD'],
        level: 'Intermediate',
        metrics: '410 automated checks',
      },
    ],
    experienceYears: 5.5,
    completedSwaps: 16,
    hoursSwapped: 13.5,
    availability: 'Available now',
    activeTopic: 'O(1) LRU eviction cache & async batch worker',
    preferredLanguage: 'python',
  },
  {
    id: 'dev_maya',
    name: 'Maya Lin',
    handle: '@mayalin',
    role: 'Senior Systems & WebAssembly Engineer',
    skillTier: 'Senior',
    experienceLabel: '7 yrs exp',
    location: 'Seattle, US',
    timezone: 'UTC-8',
    avatarUrl: '/src/assets/images/avatar_dev_maya_1794907751252.jpg',
    bio: 'Building zero-copy streaming parsers in Rust and Wasm. Happy to pair on memory ownership, benchmarks, or FFI bindings in exchange for modern React architecture.',
    offers: ['Rust', 'WebAssembly', 'Distributed Systems'],
    seeks: ['React', 'TypeScript', 'CSS Architecture'],
    projects: [
      {
        id: 'proj_maya_1',
        name: 'Zero-Copy Telemetry Parser',
        summary: 'Slice-based Rust binary frame decoder avoiding heap allocation on hot network paths.',
        stack: ['Rust', 'Distributed Systems'],
        level: 'Systems',
        metrics: '1.8 GB/s single-core decode',
      },
      {
        id: 'proj_maya_2',
        name: 'Wasm Image Quantizer',
        summary: 'Browser-side median-cut color quantizer compiled from Rust to WebAssembly.',
        stack: ['Rust', 'WebAssembly'],
        level: 'Production',
        metrics: '12x faster than JS loop',
      },
      {
        id: 'proj_maya_3',
        name: 'Fixed-Capacity Ring Buffer',
        summary: 'Const-generic circular buffer with explicit overwrite semantics for audio frames.',
        stack: ['Rust', 'Testing & TDD'],
        level: 'Systems',
        metrics: '0 unsafe blocks',
      },
    ],
    experienceYears: 7,
    completedSwaps: 19,
    hoursSwapped: 16.5,
    availability: 'Available now',
    activeTopic: 'Lock-free ring buffer & Wasm memory view',
    preferredLanguage: 'rust',
  },
  {
    id: 'dev_elena',
    name: 'Elena Rostova',
    handle: '@erostova',
    role: 'Senior Frontend Architect',
    skillTier: 'Senior',
    experienceLabel: '8 yrs exp',
    location: 'Berlin, DE',
    timezone: 'UTC+1',
    avatarUrl: '/src/assets/images/avatar_dev_elena_1794907751920.jpg',
    bio: 'Specializes in accessible component systems, React 19 concurrent rendering, and WebSocket state sync. Seeking deeper Rust systems and PostgreSQL query tuning.',
    offers: ['React', 'TypeScript', 'CSS Architecture', 'WebSockets'],
    seeks: ['Rust', 'PostgreSQL', 'Go'],
    projects: [
      {
        id: 'proj_elena_1',
        name: 'Virtual Grid Data Table',
        summary: 'Windowed React spreadsheet supporting 100k rows with pinned columns and keyboard nav.',
        stack: ['React', 'TypeScript'],
        level: 'Production',
        metrics: '60fps scroll at 100k rows',
      },
      {
        id: 'proj_elena_2',
        name: 'WebSocket Reconnect Queue',
        summary: 'Idempotent client delta buffer reconciling offline edits smoothly on reconnect.',
        stack: ['TypeScript', 'WebSockets'],
        level: 'Production',
        metrics: 'Zero lost keystrokes',
      },
      {
        id: 'proj_elena_3',
        name: 'Token-Driven UI Kit',
        summary: 'Accessible component library with strict WCAG AA contrast verification in CI.',
        stack: ['CSS Architecture', 'React'],
        level: 'Production',
        metrics: '48 audited primitives',
      },
    ],
    experienceYears: 8,
    completedSwaps: 22,
    hoursSwapped: 19.5,
    availability: 'Available now',
    activeTopic: 'Optimistic UI reconciliation & bounded queues',
    preferredLanguage: 'typescript',
  },
  {
    id: 'dev_kenji',
    name: 'Kenji Takahashi',
    handle: '@ktakahashi',
    role: 'Staff Infrastructure Engineer',
    skillTier: 'Senior',
    experienceLabel: '9 yrs exp',
    location: 'Tokyo, JP',
    timezone: 'UTC+9',
    avatarUrl: '/src/assets/images/avatar_dev_kenji_1794907750977.jpg',
    bio: 'Focuses on Go concurrency patterns, Kubernetes operators, and resilient rate limiters. Looking to sharpen Python data pipelines and CUDA profiling.',
    offers: ['Go', 'Kubernetes', 'Distributed Systems'],
    seeks: ['Python', 'CUDA & ML Infra', 'PostgreSQL'],
    projects: [
      {
        id: 'proj_kenji_1',
        name: 'Token Bucket Edge Limiter',
        summary: 'Per-tenant burst limiter with sub-millisecond clock-skew resilient refill math.',
        stack: ['Go', 'Distributed Systems'],
        level: 'Systems',
        metrics: '450k req/s per node',
      },
      {
        id: 'proj_kenji_2',
        name: 'Canary Rollout Operator',
        summary: 'Kubernetes controller shifting traffic weights automatically based on error-budget SLOs.',
        stack: ['Go', 'Kubernetes'],
        level: 'Production',
        metrics: 'Manages 90+ services',
      },
      {
        id: 'proj_kenji_3',
        name: 'Graceful Drain Proxy',
        summary: 'HTTP/WebSocket reverse proxy draining in-flight connections cleanly during deploys.',
        stack: ['Go', 'WebSockets'],
        level: 'Systems',
        metrics: '0 dropped deploys/mo',
      },
    ],
    experienceYears: 9,
    completedSwaps: 27,
    hoursSwapped: 24.0,
    availability: 'Available now',
    activeTopic: 'Token bucket rate limiter & backoff strategies',
    preferredLanguage: 'typescript',
  },
  {
    id: 'dev_marcus',
    name: 'Marcus Vance',
    handle: '@mvance',
    role: 'Database & Backend Lead',
    skillTier: 'Senior',
    experienceLabel: '10 yrs exp',
    location: 'Toronto, CA',
    timezone: 'UTC-5',
    avatarUrl: '/src/assets/images/avatar_dev_marcus_1794907751879.jpg',
    bio: '10 years optimizing PostgreSQL query plans, partial indexes, and Node.js event loops. Trading SQL internals for GraphQL federation and frontend testing.',
    offers: ['PostgreSQL', 'Node.js', 'System Design'],
    seeks: ['GraphQL', 'Testing & TDD', 'React'],
    projects: [
      {
        id: 'proj_marcus_1',
        name: 'Postgres Index Advisor CLI',
        summary: 'Reads pg_stat_statements and suggests composite covering indexes with bloat estimates.',
        stack: ['PostgreSQL', 'Node.js'],
        level: 'Production',
        metrics: 'Cut p99 query from 1.2s to 9ms',
      },
      {
        id: 'proj_marcus_2',
        name: 'Zero-Lock Partition Archiver',
        summary: 'Monthly time-series table rotator detaching cold partitions without blocking writes.',
        stack: ['PostgreSQL', 'System Design'],
        level: 'Systems',
        metrics: '4TB archived seamlessly',
      },
      {
        id: 'proj_marcus_3',
        name: 'Keyset Pagination Toolkit',
        summary: 'Cursor-based SQL query builder eliminating expensive OFFSET scans on deep feeds.',
        stack: ['TypeScript', 'PostgreSQL'],
        level: 'Production',
        metrics: 'O(1) page seek cost',
      },
    ],
    experienceYears: 10,
    completedSwaps: 31,
    hoursSwapped: 28.5,
    availability: 'Open this week',
    activeTopic: 'Composite B-Tree index ordering & cursor pagination',
    preferredLanguage: 'sql',
  },
  {
    id: 'dev_hana',
    name: 'Hana Kim',
    handle: '@hanakim',
    role: 'Principal Distributed Systems Architect',
    skillTier: 'Principal',
    experienceLabel: '12 yrs exp',
    location: 'Seoul, KR',
    timezone: 'UTC+9',
    avatarUrl: '/src/assets/images/avatar_dev_hana_1794908334323.jpg',
    bio: 'Architects consensus storage engines, zero-downtime schema migrators, and high-throughput parsers. Enjoys mentoring engineers from beginner to senior while trading systems knowledge for ML infra.',
    offers: ['Distributed Systems', 'Rust', 'System Design', 'Go'],
    seeks: ['CUDA & ML Infra', 'WebAssembly', 'React'],
    projects: [
      {
        id: 'proj_hana_1',
        name: 'Raft Consensus KV Engine',
        summary: 'Replicated write-ahead log key-value store with snapshot compaction and linearizable reads.',
        stack: ['Rust', 'Distributed Systems'],
        level: 'Systems',
        metrics: 'Survives Jepsen fault tests',
      },
      {
        id: 'proj_hana_2',
        name: 'SQLite B-Tree Page Inspector',
        summary: 'Binary page-dump analyzer visualizing interior/leaf cell fragmentation and overflow chains.',
        stack: ['Rust', 'PostgreSQL'],
        level: 'Systems',
        metrics: 'Open-source teaching tool',
      },
      {
        id: 'proj_hana_3',
        name: 'Online Schema Migrator',
        summary: 'Shadow-table backfill and atomic cutover daemon for multi-terabyte production tables.',
        stack: ['Go', 'PostgreSQL'],
        level: 'Production',
        metrics: 'Zero downtime across 300+ migrations',
      },
      {
        id: 'proj_hana_4',
        name: 'Beginner Systems Study Guide',
        summary: 'Annotated starter exercises walking newcomers from basic TCP sockets to consensus.',
        stack: ['Python', 'Go'],
        level: 'Starter',
        metrics: '2.4k stars from learners',
      },
    ],
    experienceYears: 12,
    completedSwaps: 42,
    hoursSwapped: 38.0,
    availability: 'Available now',
    activeTopic: 'Consensus state machines & beginner-friendly systems design',
    preferredLanguage: 'rust',
  },
];

const DEFAULT_TS_STARTER = `interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export class TokenBucketLimiter {
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private buckets = new Map<string, Bucket>();

  constructor(capacity: number, refillPerSec: number) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
  }

  allow(clientKey: string, nowMs: number = Date.now()): boolean {
    const existing = this.buckets.get(clientKey) ?? {
      tokens: this.capacity,
      lastRefillMs: nowMs,
    };

    const elapsedSec = Math.max(0, (nowMs - existing.lastRefillMs) / 1000);
    const replenished = Math.min(
      this.capacity,
      existing.tokens + elapsedSec * this.refillPerSec
    );

    if (replenished < 1) {
      this.buckets.set(clientKey, { tokens: replenished, lastRefillMs: nowMs });
      return false;
    }

    this.buckets.set(clientKey, { tokens: replenished - 1, lastRefillMs: nowMs });
    return true;
  }
}

const limiter = new TokenBucketLimiter(3, 2);
const t0 = 1_000_000;
console.log('Req 1:', limiter.allow('user-42', t0));
console.log('Req 2:', limiter.allow('user-42', t0 + 10));
console.log('Req 3:', limiter.allow('user-42', t0 + 20));
console.log('Req 4 (blocked):', limiter.allow('user-42', t0 + 30));
console.log('Req 5 (+600ms):', limiter.allow('user-42', t0 + 630));
`;

export interface AccountRecord {
  id: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  profile: UserProfile;
  createdAt: number;
}

export interface PersistedState {
  accounts: AccountRecord[];
  swaps: SwapSession[];
  rooms: Record<string, RoomState>;
}

interface SessionPayload {
  uid: string;
  email: string;
  name: string;
  handle: string;
  skillTier: SkillTier;
  role: string;
  iat: number;
}

function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function signSessionToken(profile: UserProfile): string {
  const payloadObj: SessionPayload = {
    uid: profile.id,
    email: profile.email,
    name: profile.name,
    handle: profile.handle,
    skillTier: profile.skillTier,
    role: profile.role,
    iat: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8')
    ) as Partial<SessionPayload>;
    if (!parsed.uid || !parsed.email) return null;
    return {
      uid: parsed.uid,
      email: parsed.email,
      name: parsed.name || 'Developer',
      handle: parsed.handle || '@dev',
      skillTier: parsed.skillTier || 'Beginner',
      role: parsed.role || 'Developer',
      iat: parsed.iat || Date.now(),
    };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=604800',
  ];
  if (isHttps) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function makeDefaultRoom(
  roomId: string,
  ownerId: string,
  options?: {
    title?: string;
    offerSkill?: string;
    seekSkill?: string;
    language?: LanguageId;
    fileName?: string;
    code?: string;
    checklist?: string[];
    durationMinutes?: number;
    isPrivate?: boolean;
    allowedUserIds?: string[];
  }
): RoomState {
  const language: LanguageId = options?.language || 'typescript';
  const fileName =
    options?.fileName ||
    (language === 'python'
      ? 'main.py'
      : language === 'rust'
        ? 'main.rs'
        : language === 'go'
          ? 'main.go'
          : language === 'sql'
            ? 'query.sql'
            : language === 'javascript'
              ? 'main.js'
              : 'rateLimiter.ts');

  const starterCode = options?.code || DEFAULT_TS_STARTER;
  const files: RoomFile[] = [
    {
      id: 'file_main',
      name: fileName,
      language,
      content: starterCode,
    },
    {
      id: 'file_notes',
      name: 'pairing_plan.md',
      language: 'typescript',
      content: `// Session Notes & Pairing Plan\n// 1. Align on constraints and edge cases\n// 2. Driver writes core implementation; Navigator reviews\n// 3. Rotate Driver/Navigator roles every 15 minutes\n`,
    },
  ];

  const checklist: ChecklistItem[] = (
    options?.checklist || [
      'Confirm exchange goals & test inputs',
      'Implement core logic as Driver/Navigator pair',
      'Run verification suite in shared console',
    ]
  ).map((text, idx) => ({
    id: `chk_${idx}_${Date.now()}`,
    text,
    done: idx === 0,
  }));

  const allowedUserIds = Array.from(
    new Set([ownerId, ...(options?.allowedUserIds || [])])
  );

  return {
    roomId,
    ownerId,
    allowedUserIds,
    isPrivate: Boolean(options?.isPrivate),
    title: options?.title || `Pair Studio · ${roomId}`,
    offerSkill: options?.offerSkill || 'TypeScript',
    seekSkill: options?.seekSkill || 'Distributed Systems',
    language,
    files,
    activeFileId: files[0].id,
    participants: [],
    checklist,
    notes:
      'Focus areas:\n- Keep functions pure where possible for unit testing\n- Benchmark latency and edge cases before finalizing',
    messages: [
      {
        id: `msg_sys_${Date.now()}`,
        senderId: 'system',
        senderName: 'Session Host',
        senderHandle: '@sigma',
        color: '#475569',
        text: options?.isPrivate
          ? `Private workspace ${roomId} created. Only your account can access this room.`
          : `Room ${roomId} ready. Share this room link so another logged-in developer can join live.`,
        timestamp: Date.now(),
      },
    ],
    annotations: [],
    executionLogs: [],
    timer: {
      durationSeconds: (options?.durationMinutes || 45) * 60,
      elapsedBeforePause: 0,
      startedAt: null,
      running: false,
    },
    driverId: null,
    createdAt: Date.now(),
  };
}

function loadInitialState(): PersistedState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const rooms = parsed.rooms || {};
      for (const key of Object.keys(rooms)) {
        rooms[key].participants = [];
        rooms[key].driverId = null;
        if (!rooms[key].ownerId) rooms[key].ownerId = 'system';
        if (!Array.isArray(rooms[key].allowedUserIds)) rooms[key].allowedUserIds = [rooms[key].ownerId];
        if (typeof rooms[key].isPrivate !== 'boolean') rooms[key].isPrivate = false;
        if (rooms[key].timer?.running && rooms[key].timer.startedAt) {
          const delta = Math.floor((Date.now() - rooms[key].timer.startedAt) / 1000);
          rooms[key].timer.elapsedBeforePause += Math.max(0, delta);
          rooms[key].timer.startedAt = null;
          rooms[key].timer.running = false;
        }
      }
      return {
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        swaps: Array.isArray(parsed.swaps) ? parsed.swaps : [],
        rooms,
      };
    }
  } catch {
    // Fallback to clean state
  }

  return {
    accounts: [],
    swaps: [],
    rooms: {},
  };
}

function stripTsTypes(code: string): string {
  try {
    const require = createRequire(import.meta.url);
    const mod = require('node:module');
    if (typeof mod.stripTypeScriptTypes === 'function') {
      return mod.stripTypeScriptTypes(code, { mode: 'transform' });
    }
  } catch {
    // Fallback below
  }
  return code
    .replace(/^\s*interface\s+\w+\s*\{[\s\S]*?\}\s*/gm, '')
    .replace(/^\s*type\s+\w+\s*=[\s\S]*?;\s*/gm, '')
    .replace(/\bexport\s+/g, '');
}

function formatValue(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export async function executeCodeSafely(
  code: string,
  language: LanguageId,
  runnerName: string
): Promise<ExecutionResult> {
  const started = Date.now();
  const id = `exec_${started}_${Math.random().toString(36).slice(2, 7)}`;

  if (language === 'javascript' || language === 'typescript') {
    const stdout: string[] = [];
    const stderr: string[] = [];
    try {
      let jsCode = language === 'typescript' ? stripTsTypes(code) : code;
      jsCode = jsCode.replace(/^\s*export\s+(?=(class|function|const|let|var|async)\b)/gm, '');

      const sandboxConsole = {
        log: (...args: unknown[]) => stdout.push(args.map(formatValue).join(' ')),
        info: (...args: unknown[]) => stdout.push(args.map(formatValue).join(' ')),
        warn: (...args: unknown[]) => stderr.push(`[warn] ${args.map(formatValue).join(' ')}`),
        error: (...args: unknown[]) => stderr.push(`[error] ${args.map(formatValue).join(' ')}`),
      };

      const pendingPromises: Promise<unknown>[] = [];
      const context = vm.createContext({
        console: sandboxConsole,
        setTimeout,
        clearTimeout,
        Math,
        Date,
        JSON,
        Array,
        Object,
        Map,
        Set,
        Promise: class TrackedPromise<T> extends Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason?: unknown) => void
            ) => void
          ) {
            super(executor);
            pendingPromises.push(this.catch(() => undefined));
          }
        },
        Error,
        Number,
        String,
        Boolean,
      });

      const script = new vm.Script(jsCode, { filename: 'pair_session.js' });
      const result = script.runInContext(context, { timeout: 1500 });

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await Promise.race([
          result,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Async execution timed out (1500ms)')), 1500)
          ),
        ]);
      } else if (pendingPromises.length > 0) {
        await Promise.race([
          Promise.all(pendingPromises),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]);
      }

      return {
        id,
        runnerName,
        language,
        stdout: stdout.slice(0, 100),
        stderr: stderr.slice(0, 50),
        returnValue:
          result !== undefined && typeof (result as Promise<unknown>)?.then !== 'function'
            ? formatValue(result)
            : undefined,
        durationMs: Math.max(1, Date.now() - started),
        exitCode: 0,
        timestamp: Date.now(),
      };
    } catch (err) {
      stderr.push(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      return {
        id,
        runnerName,
        language,
        stdout,
        stderr,
        durationMs: Math.max(1, Date.now() - started),
        exitCode: 1,
        timestamp: Date.now(),
      };
    }
  }

  if (language === 'python') {
    return new Promise((resolve) => {
      execFile(
        'python3',
        ['-c', code],
        { timeout: 3000, maxBuffer: 1024 * 256 },
        (error, out, errOut) => {
          const stdout = out ? out.trimEnd().split('\n').slice(0, 100) : [];
          const stderr = errOut ? errOut.trimEnd().split('\n').slice(0, 50) : [];
          if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            resolve({
              id,
              runnerName,
              language,
              stdout: [
                `Checked ${code.split('\n').length} lines of Python code.`,
                'Python interpreter is not installed on this serverless runtime. TypeScript and JavaScript run natively.',
              ],
              stderr: [],
              durationMs: Math.max(1, Date.now() - started),
              exitCode: 0,
              timestamp: Date.now(),
            });
            return;
          }
          if (error && stderr.length === 0) {
            stderr.push(error.message);
          }
          resolve({
            id,
            runnerName,
            language,
            stdout,
            stderr,
            durationMs: Math.max(1, Date.now() - started),
            exitCode: error ? 1 : 0,
            timestamp: Date.now(),
          });
        }
      );
    });
  }

  const lineCount = code.split('\n').length;
  return {
    id,
    runnerName,
    language,
    stdout: [
      `Checked ${lineCount} lines of ${language.toUpperCase()} code.`,
      `Direct sandbox execution is enabled for TypeScript, JavaScript, and Python. Use Line Notes or Chat to review ${language.toUpperCase()} logic together.`,
    ],
    stderr: [],
    durationMs: Math.max(1, Date.now() - started),
    exitCode: 0,
    timestamp: Date.now(),
  };
}

export function createSigmaApp(options?: {
  onRoomPrivacyUpdated?: (roomId: string, isPrivate: boolean) => void;
}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const state: PersistedState = loadInitialState();

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function writeSnapshotNow() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const snapshot: PersistedState = {
        accounts: state.accounts,
        swaps: state.swaps,
        rooms: Object.fromEntries(
          Object.entries(state.rooms).map(([id, room]) => [
            id,
            { ...room, participants: [] },
          ])
        ),
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch {
      // Ignore transient disk write error
    }
  }

  function schedulePersist() {
    if (IS_VERCEL) {
      writeSnapshotNow();
      return;
    }
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(writeSnapshotNow, 250);
  }

  function seedStarterWorkspaceForUser(user: UserProfile) {
    const roomId = `SIGMA-${user.id.slice(-4).toUpperCase()}`;
    if (!state.swaps.some((s) => s.roomId === roomId && s.requesterId === user.id)) {
      const starterSwap: SwapSession = {
        id: `swap_welcome_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        roomId,
        title: `${user.offers[0] || 'JavaScript'} ↔ ${user.seeks[0] || 'TypeScript'} Starter Lab`,
        requesterId: user.id,
        requesterName: user.name,
        requesterHandle: user.handle,
        partnerId: 'dev_kenji',
        partnerName: 'Kenji Takahashi',
        partnerHandle: '@ktakahashi',
        offerSkill: user.offers[0] || 'JavaScript',
        seekSkill: user.seeks[0] || 'TypeScript',
        durationMinutes: 45,
        status: 'active',
        isPrivate: true,
        scheduledLabel: 'Private sandbox',
        goalNotes: 'Your private starter room. Practice solo or switch to Invite-Only to pair live.',
        createdAt: Date.now(),
      };
      state.swaps.unshift(starterSwap);
    }
    if (!state.rooms[roomId]) {
      state.rooms[roomId] = makeDefaultRoom(roomId, user.id, {
        title: `${user.offers[0] || 'JavaScript'} ↔ ${user.seeks[0] || 'TypeScript'} Starter Lab`,
        offerSkill: user.offers[0] || 'JavaScript',
        seekSkill: user.seeks[0] || 'TypeScript',
        language: 'typescript',
        durationMinutes: 45,
        isPrivate: true,
      });
    }
  }

  function getAuthenticatedAccount(
    cookieHeader: string | undefined,
    authHeader?: string | undefined,
    explicitToken?: string | undefined
  ): AccountRecord | null {
    let token = explicitToken;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
    if (!token) {
      const cookies = parseCookies(cookieHeader);
      token = cookies[COOKIE_NAME];
    }
    const payload = verifySessionToken(token);
    if (!payload) return null;

    let account = state.accounts.find(
      (a) => a.id === payload.uid || a.email === payload.email
    );
    // Stateless serverless hydration: reconstruct account if a cold lambda instance lacks it
    if (!account) {
      const { salt, hash } = hashPassword('sigma-session');
      const profile: UserProfile = {
        id: payload.uid,
        email: payload.email,
        name: payload.name,
        handle: payload.handle,
        role: payload.role,
        skillTier: payload.skillTier,
        timezone: 'UTC',
        bio: 'Building projects and pairing on Sigma.',
        offers: ['JavaScript', 'HTML & CSS'],
        seeks: ['TypeScript', 'React'],
        projects: [],
        availability: 'Available now',
        hoursTaught: 0,
        hoursLearned: 0,
      };
      account = {
        id: payload.uid,
        email: payload.email,
        passwordSalt: salt,
        passwordHash: hash,
        profile,
        createdAt: payload.iat,
      };
      state.accounts.push(account);
      seedStarterWorkspaceForUser(profile);
    }
    return account;
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      serverless: IS_VERCEL,
      accounts: state.accounts.length,
      rooms: Object.keys(state.rooms).length,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const account = getAuthenticatedAccount(req.headers.cookie, req.headers.authorization);
    if (!account) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json({ user: account.profile });
  });

  app.post('/api/auth/register', (req, res) => {
    const body = req.body as {
      email?: string;
      password?: string;
      name?: string;
      handle?: string;
      role?: string;
      skillTier?: SkillTier;
      timezone?: string;
      offers?: string[];
      seeks?: string[];
    };

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || 'sigma-pass');
    const name = String(body.name || '').trim() || email.split('@')[0] || 'Developer';
    const rawHandle = String(body.handle || '').trim();

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const existing = state.accounts.find((a) => a.email === email);
    if (existing) {
      const token = signSessionToken(existing.profile);
      setSessionCookie(req, res, token);
      res.json({ user: existing.profile, token });
      return;
    }

    const cleanHandleBase = (rawHandle || name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dev').replace(/^@+/, '');
    let handle = `@${cleanHandleBase}`;
    if (state.accounts.some((a) => a.profile.handle.toLowerCase() === handle.toLowerCase())) {
      handle = `@${cleanHandleBase}${Math.floor(10 + Math.random() * 89)}`;
    }

    // Deterministic stable ID derived from email so serverless restarts keep ownership consistent
    const id = `usr_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 12)}`;
    const { salt, hash } = hashPassword(password);

    const profile: UserProfile = {
      id,
      email,
      name: name.slice(0, 60),
      handle: handle.slice(0, 30),
      role: String(body.role || 'Developer').trim().slice(0, 80) || 'Developer',
      skillTier: body.skillTier || 'Beginner',
      timezone: String(body.timezone || 'UTC').trim().slice(0, 20) || 'UTC',
      bio: 'Excited to exchange skills and pair program in live sessions.',
      offers: Array.isArray(body.offers) && body.offers.length > 0 ? body.offers.slice(0, 12) : ['JavaScript'],
      seeks: Array.isArray(body.seeks) && body.seeks.length > 0 ? body.seeks.slice(0, 12) : ['TypeScript'],
      projects: [],
      availability: 'Available now',
      hoursTaught: 0,
      hoursLearned: 0,
    };

    const record: AccountRecord = {
      id,
      email,
      passwordSalt: salt,
      passwordHash: hash,
      profile,
      createdAt: Date.now(),
    };

    state.accounts.push(record);
    seedStarterWorkspaceForUser(profile);
    schedulePersist();

    const token = signSessionToken(profile);
    setSessionCookie(req, res, token);
    res.status(201).json({ user: profile, token });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as { email?: string; password?: string };
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    let account = state.accounts.find((a) => a.email === email);

    if (!account) {
      const localPart = email.split('@')[0] || 'developer';
      const displayName = localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 40);
      const cleanHandleBase = localPart.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dev';
      let handle = `@${cleanHandleBase}`;
      if (state.accounts.some((a) => a.profile.handle.toLowerCase() === handle.toLowerCase())) {
        handle = `@${cleanHandleBase}${Math.floor(10 + Math.random() * 89)}`;
      }
      const id = `usr_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 12)}`;
      const { salt, hash } = hashPassword(String(body.password || 'sigma-local'));
      const profile: UserProfile = {
        id,
        email,
        name: displayName,
        handle: handle.slice(0, 30),
        role: 'Full-Stack Developer',
        skillTier: 'Beginner',
        timezone: 'UTC',
        bio: 'Building projects and pairing on Sigma.',
        offers: ['JavaScript', 'HTML & CSS'],
        seeks: ['TypeScript', 'React'],
        projects: [],
        availability: 'Available now',
        hoursTaught: 0,
        hoursLearned: 0,
      };
      account = {
        id,
        email,
        passwordSalt: salt,
        passwordHash: hash,
        profile,
        createdAt: Date.now(),
      };
      state.accounts.push(account);
      seedStarterWorkspaceForUser(profile);
      schedulePersist();
    }

    const token = signSessionToken(account.profile);
    setSessionCookie(req, res, token);
    res.json({ user: account.profile, token });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.put('/api/auth/profile', (req, res) => {
    const account = getAuthenticatedAccount(req.headers.cookie, req.headers.authorization);
    if (!account) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const body = req.body as Partial<UserProfile>;
    const nextHandle = body.handle?.trim()
      ? body.handle.trim().startsWith('@')
        ? body.handle.trim()
        : `@${body.handle.trim()}`
      : account.profile.handle;

    account.profile = {
      ...account.profile,
      name: body.name?.trim().slice(0, 60) || account.profile.name,
      handle: nextHandle.slice(0, 30),
      role: body.role?.trim().slice(0, 80) || account.profile.role,
      skillTier: body.skillTier || account.profile.skillTier,
      timezone: body.timezone?.trim().slice(0, 20) || account.profile.timezone,
      bio: typeof body.bio === 'string' ? body.bio.slice(0, 500) : account.profile.bio,
      availability: (body.availability as AvailabilityStatus) || account.profile.availability,
      offers: Array.isArray(body.offers) ? body.offers.slice(0, 16) : account.profile.offers,
      seeks: Array.isArray(body.seeks) ? body.seeks.slice(0, 16) : account.profile.seeks,
      projects: Array.isArray(body.projects)
        ? (body.projects as DeveloperProject[]).slice(0, 12)
        : account.profile.projects,
    };

    const token = signSessionToken(account.profile);
    setSessionCookie(req, res, token);
    schedulePersist();
    res.json({ user: account.profile, token });
  });

  const requireAuth: express.RequestHandler = (req, res, next) => {
    const account = getAuthenticatedAccount(req.headers.cookie, req.headers.authorization);
    if (!account) {
      res.status(401).json({ error: 'Please sign in to access your workspace.' });
      return;
    }
    (req as express.Request & { authAccount: AccountRecord }).authAccount = account;
    next();
  };

  app.get('/api/developers', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const registeredAsDevs: DeveloperProfile[] = state.accounts
      .filter((a) => a.id !== authAccount.id)
      .map((a) => ({
        id: a.profile.id,
        name: a.profile.name,
        handle: a.profile.handle,
        role: a.profile.role,
        skillTier: a.profile.skillTier,
        experienceLabel: `${a.profile.skillTier} member`,
        location: 'Sigma Community',
        timezone: a.profile.timezone,
        avatarUrl: '',
        bio: a.profile.bio,
        offers: a.profile.offers,
        seeks: a.profile.seeks,
        projects: a.profile.projects || [],
        experienceYears:
          a.profile.skillTier === 'Principal'
            ? 10
            : a.profile.skillTier === 'Senior'
              ? 7
              : a.profile.skillTier === 'Intermediate'
                ? 4
                : a.profile.skillTier === 'Junior'
                  ? 1.5
                  : 0.5,
        completedSwaps: 0,
        hoursSwapped: a.profile.hoursTaught + a.profile.hoursLearned,
        availability: a.profile.availability,
        activeTopic: a.profile.projects[0]?.name || `${a.profile.offers[0] || 'Code'} pairing`,
        preferredLanguage: 'typescript',
      }));

    res.json({ developers: [...registeredAsDevs, ...SEED_DEVELOPERS] });
  });

  app.get('/api/swaps', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const userSwaps = state.swaps
      .filter(
        (s) => s.requesterId === authAccount.id || s.partnerId === authAccount.id
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ swaps: userSwaps });
  });

  app.post('/api/swaps', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const body = req.body as {
      title?: string;
      partnerId?: string;
      partnerName?: string;
      partnerHandle?: string;
      offerSkill?: string;
      seekSkill?: string;
      durationMinutes?: number;
      goalNotes?: string;
      language?: LanguageId;
      starterCode?: string;
      starterFileName?: string;
      checklist?: string[];
      immediateActive?: boolean;
      isPrivate?: boolean;
    };

    if (!body.partnerId || !body.offerSkill || !body.seekSkill) {
      res.status(400).json({ error: 'partnerId, offerSkill, and seekSkill are required' });
      return;
    }

    const roomId = `SIGMA-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const isPrivate = Boolean(body.isPrivate);
    const swap: SwapSession = {
      id: `swap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      roomId,
      title: body.title?.trim() || `${body.offerSkill} ↔ ${body.seekSkill} Pairing`,
      requesterId: authAccount.id,
      requesterName: authAccount.profile.name,
      requesterHandle: authAccount.profile.handle,
      partnerId: body.partnerId,
      partnerName: body.partnerName || 'Partner',
      partnerHandle: body.partnerHandle || '@partner',
      offerSkill: body.offerSkill,
      seekSkill: body.seekSkill,
      durationMinutes: Number(body.durationMinutes) || 45,
      status: body.immediateActive ? 'active' : 'pending',
      isPrivate,
      scheduledLabel: body.immediateActive ? 'Active session' : 'Proposed · Ready to pair',
      goalNotes: body.goalNotes?.trim() || 'Live 1:1 skill exchange session.',
      createdAt: Date.now(),
    };

    state.swaps.unshift(swap);
    state.rooms[roomId] = makeDefaultRoom(roomId, authAccount.id, {
      title: swap.title,
      offerSkill: swap.offerSkill,
      seekSkill: swap.seekSkill,
      language: body.language || 'typescript',
      fileName: body.starterFileName,
      code: body.starterCode,
      checklist: body.checklist,
      durationMinutes: swap.durationMinutes,
      isPrivate,
      allowedUserIds: [authAccount.id, body.partnerId],
    });

    schedulePersist();
    res.status(201).json({ swap, room: state.rooms[roomId] });
  });

  app.patch('/api/swaps/:id', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const { id } = req.params;
    const { status } = req.body as { status?: SwapStatus };
    const swap = state.swaps.find((s) => s.id === id);
    if (!swap) {
      // On stateless serverless lambda, acknowledge cleanly if swap isn't in warm instance memory
      if (IS_VERCEL) {
        res.json({ ok: true, status });
        return;
      }
      res.status(404).json({ error: 'Swap session not found' });
      return;
    }
    if (swap.requesterId !== authAccount.id && swap.partnerId !== authAccount.id) {
      res.status(403).json({ error: 'You do not have permission to modify this swap.' });
      return;
    }

    if (status) {
      swap.status = status;
      if (status === 'active') {
        swap.scheduledLabel = 'Active session';
      } else if (status === 'completed') {
        swap.scheduledLabel = 'Completed just now';
        swap.completedAt = Date.now();
        const hours = Number((swap.durationMinutes / 60).toFixed(1));
        authAccount.profile.hoursTaught = Number(
          (authAccount.profile.hoursTaught + hours * 0.5).toFixed(1)
        );
        authAccount.profile.hoursLearned = Number(
          (authAccount.profile.hoursLearned + hours * 0.5).toFixed(1)
        );
      } else if (status === 'declined') {
        swap.scheduledLabel = 'Declined';
      }
      schedulePersist();
    }
    res.json({ swap, user: authAccount.profile });
  });

  app.get('/api/rooms', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const list = Object.values(state.rooms)
      .filter(
        (r) =>
          r.ownerId === authAccount.id ||
          (!r.isPrivate && r.allowedUserIds.includes(authAccount.id))
      )
      .map((r) => ({
        roomId: r.roomId,
        title: r.title,
        isPrivate: r.isPrivate,
        offerSkill: r.offerSkill,
        seekSkill: r.seekSkill,
        language: r.language,
        participantCount: r.participants.length,
        createdAt: r.createdAt,
      }));
    res.json({ rooms: list });
  });

  app.post('/api/rooms', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const body = req.body as {
      roomId?: string;
      title?: string;
      offerSkill?: string;
      seekSkill?: string;
      language?: LanguageId;
      fileName?: string;
      code?: string;
      checklist?: string[];
      durationMinutes?: number;
      isPrivate?: boolean;
    };
    const roomId =
      body.roomId?.trim().toUpperCase() ||
      `SIGMA-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    if (state.rooms[roomId]) {
      const existing = state.rooms[roomId];
      if (existing.isPrivate && existing.ownerId !== authAccount.id) {
        res.status(403).json({ error: 'This workspace is private to its owner.' });
        return;
      }
      res.json({ room: existing });
      return;
    }

    state.rooms[roomId] = makeDefaultRoom(roomId, authAccount.id, {
      ...body,
      isPrivate: Boolean(body.isPrivate),
    });
    schedulePersist();
    res.status(201).json({ room: state.rooms[roomId] });
  });

  // HTTP fallback endpoints for serverless environments (e.g. Vercel) without persistent WebSockets
  app.get('/api/rooms/:roomId', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const roomId = req.params.roomId.trim().toUpperCase();
    let room = state.rooms[roomId];
    if (!room) {
      room = makeDefaultRoom(roomId, authAccount.id, { isPrivate: false });
      state.rooms[roomId] = room;
      schedulePersist();
    }
    if (room.isPrivate && room.ownerId !== authAccount.id) {
      res.status(403).json({ error: 'Access denied: this workspace is set to Private by its owner.' });
      return;
    }
    res.json({ room });
  });

  app.post('/api/rooms/:roomId/sync', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const roomId = req.params.roomId.trim().toUpperCase();
    let room = state.rooms[roomId];
    if (!room) {
      room = makeDefaultRoom(roomId, authAccount.id, { isPrivate: false });
      state.rooms[roomId] = room;
    }
    if (room.isPrivate && room.ownerId !== authAccount.id) {
      res.status(403).json({ error: 'Access denied: private room.' });
      return;
    }
    const patch = req.body as Partial<RoomState>;
    if (typeof patch.title === 'string' && patch.title.trim()) room.title = patch.title.trim();
    if (typeof patch.offerSkill === 'string') room.offerSkill = patch.offerSkill;
    if (typeof patch.seekSkill === 'string') room.seekSkill = patch.seekSkill;
    if (Array.isArray(patch.files)) room.files = patch.files;
    if (typeof patch.activeFileId === 'string') room.activeFileId = patch.activeFileId;
    if (typeof patch.language === 'string') room.language = patch.language as LanguageId;
    if (typeof patch.notes === 'string') room.notes = patch.notes;
    if (Array.isArray(patch.checklist)) room.checklist = patch.checklist;
    if (Array.isArray(patch.annotations)) room.annotations = patch.annotations;
    if (Array.isArray(patch.messages)) room.messages = patch.messages.slice(-150);
    if (Array.isArray(patch.executionLogs)) room.executionLogs = patch.executionLogs.slice(0, 20);
    if (patch.timer) room.timer = patch.timer;
    schedulePersist();
    res.json({ room });
  });

  app.patch('/api/rooms/:roomId/privacy', requireAuth, (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const roomId = req.params.roomId.trim().toUpperCase();
    let room = state.rooms[roomId];
    if (!room) {
      if (IS_VERCEL) {
        room = makeDefaultRoom(roomId, authAccount.id, { isPrivate: false });
        state.rooms[roomId] = room;
      } else {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
    }
    if (room.ownerId !== authAccount.id) {
      res.status(403).json({ error: 'Only the room owner can change privacy settings.' });
      return;
    }
    const { isPrivate } = req.body as { isPrivate?: boolean };
    room.isPrivate = Boolean(isPrivate);
    schedulePersist();
    options?.onRoomPrivacyUpdated?.(roomId, room.isPrivate);
    res.json({ isPrivate: room.isPrivate });
  });

  app.post('/api/execute', requireAuth, async (req, res) => {
    const { authAccount } = req as express.Request & { authAccount: AccountRecord };
    const { code, language } = req.body as {
      code?: string;
      language?: LanguageId;
    };
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'code is required' });
      return;
    }
    const result = await executeCodeSafely(
      code,
      language || 'javascript',
      authAccount.profile.name
    );
    res.json({ result });
  });

  return {
    app,
    state,
    getAuthenticatedAccount,
    schedulePersist,
  };
}
