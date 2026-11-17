import type { LanguageId, SkillTier } from '../types/sigma.ts';

export interface CodeChallengePreset {
  id: string;
  title: string;
  language: LanguageId;
  fileName: string;
  summary: string;
  code: string;
  checklist: string[];
}

export const SKILL_TIERS: { id: SkillTier; label: string; hint: string }[] = [
  { id: 'Beginner', label: 'Beginner', hint: '0–1 yrs · Learning fundamentals & first projects' },
  { id: 'Junior', label: 'Junior', hint: '1–2 yrs · Building web apps & APIs' },
  { id: 'Intermediate', label: 'Intermediate', hint: '3–5 yrs · Owning production services' },
  { id: 'Senior', label: 'Senior', hint: '6–10 yrs · Architecture, scale & mentoring' },
  { id: 'Principal', label: 'Principal', hint: '10+ yrs · Distributed systems & deep internals' },
];

export const SKILL_CATALOG: string[] = [
  'HTML & CSS',
  'JavaScript',
  'TypeScript',
  'React',
  'Python',
  'Git & GitHub',
  'REST APIs',
  'Node.js',
  'PostgreSQL',
  'Docker',
  'Rust',
  'Go',
  'Distributed Systems',
  'WebAssembly',
  'Kubernetes',
  'System Design',
  'Testing & TDD',
  'GraphQL',
  'WebSockets',
  'CSS Architecture',
  'CUDA & ML Infra',
];

export const CHALLENGE_PRESETS: CodeChallengePreset[] = [
  {
    id: 'expense-splitter-js',
    title: 'Expense Splitter & Edge Cases (Beginner)',
    language: 'javascript',
    fileName: 'splitBill.js',
    summary: 'Practice clean functions, rounding cents safely, and writing simple assertions together.',
    checklist: [
      'Avoid floating-point drift by working in integer cents',
      'Handle empty participant arrays gracefully',
      'Verify remainder cents distribution matches total',
    ],
    code: `function splitExpense(totalDollars, people) {
  if (!Array.isArray(people) || people.length === 0) {
    throw new Error('At least one participant is required');
  }

  const totalCents = Math.round(totalDollars * 100);
  const baseShare = Math.floor(totalCents / people.length);
  let remainder = totalCents % people.length;

  return people.map((name) => {
    const extraCent = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return {
      name,
      owesDollars: ((baseShare + extraCent) / 100).toFixed(2),
    };
  });
}

// Pair exercise: test tricky cent splits
console.log('Split $100 across 3:', splitExpense(100, ['Lucas', 'Tessa', 'Maya']));
console.log('Split $24.50 across 2:', splitExpense(24.5, ['Alex', 'Devon']));
`,
  },
  {
    id: 'token-bucket-ts',
    title: 'Distributed Rate Limiter (Token Bucket)',
    language: 'typescript',
    fileName: 'rateLimiter.ts',
    summary: 'Implement a refill-on-read token bucket rate limiter and verify burst handling.',
    checklist: [
      'Implement token refill math using elapsed milliseconds',
      'Guard against negative token counts under concurrent calls',
      'Run the verification assertions in the console',
    ],
    code: `interface Bucket {
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
      this.buckets.set(clientKey, {
        tokens: replenished,
        lastRefillMs: nowMs,
      });
      return false;
    }

    this.buckets.set(clientKey, {
      tokens: replenished - 1,
      lastRefillMs: nowMs,
    });
    return true;
  }
}

// Pair exercise: test burst & refill behavior
const limiter = new TokenBucketLimiter(3, 2);
const t0 = 1_000_000;

console.log('Req 1:', limiter.allow('user-42', t0));
console.log('Req 2:', limiter.allow('user-42', t0 + 10));
console.log('Req 3:', limiter.allow('user-42', t0 + 20));
console.log('Req 4 (should block):', limiter.allow('user-42', t0 + 30));
console.log('Req 5 (+600ms refill):', limiter.allow('user-42', t0 + 630));
`,
  },
  {
    id: 'async-queue-js',
    title: 'Bounded Concurrency Task Queue',
    language: 'javascript',
    fileName: 'taskQueue.js',
    summary: 'Build a promise queue that enforces max N in-flight workers without starving.',
    checklist: [
      'Enforce maxConcurrency cap for active tasks',
      'Preserve result order matching input task array',
      'Handle rejected tasks cleanly without stalling queue',
    ],
    code: `async function runWithConcurrency(tasks, maxConcurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex++;
      try {
        results[current] = { status: 'fulfilled', value: await tasks[current]() };
      } catch (error) {
        results[current] = { status: 'rejected', reason: String(error) };
      }
    }
  }

  const workerCount = Math.min(maxConcurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

const jobs = [1, 2, 3, 4, 5].map((id) => async () => {
  const delay = (6 - id) * 15;
  await new Promise((r) => setTimeout(r, delay));
  if (id === 3) throw new Error('Transient timeout on job 3');
  return 'Job ' + id + ' completed in ' + delay + 'ms';
});

runWithConcurrency(jobs, 2).then((summary) => {
  console.log('Execution summary:');
  summary.forEach((item, idx) => console.log(idx + 1, item));
});
`,
  },
  {
    id: 'lru-cache-py',
    title: 'O(1) LRU Cache Implementation',
    language: 'python',
    fileName: 'lru_cache.py',
    summary: 'Implement and benchmark an OrderedDict-backed LRU cache with hit/miss tracking.',
    checklist: [
      'Promote accessed keys to most-recently-used position',
      'Evict least-recently-used key when capacity is exceeded',
      'Verify hit rate metrics across sample workload',
    ],
    code: `from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("Capacity must be positive")
        self.capacity = capacity
        self.store = OrderedDict()
        self.hits = 0
        self.misses = 0

    def get(self, key: str):
        if key not in self.store:
            self.misses += 1
            return None
        self.hits += 1
        self.store.move_to_end(key)
        return self.store[key]

    def put(self, key: str, value) -> None:
        if key in self.store:
            self.store.move_to_end(key)
        self.store[key] = value
        if len(self.store) > self.capacity:
            evicted_key, _ = self.store.popitem(last=False)
            print(f"Evicted LRU key: {evicted_key}")


cache = LRUCache(capacity=3)
cache.put("session:a", 101)
cache.put("session:b", 202)
cache.put("session:c", 303)
print("Read session:a ->", cache.get("session:a"))
cache.put("session:d", 404)
print("Read session:b (expected None) ->", cache.get("session:b"))
print(f"Cache stats -> hits={cache.hits}, misses={cache.misses}")
`,
  },
  {
    id: 'sql-index-tuning',
    title: 'PostgreSQL Query Plan & Composite Index Tuning',
    language: 'sql',
    fileName: 'swap_ledger_tuning.sql',
    summary: 'Refactor slow range + tenant filter query using composite B-Tree index ordering.',
    checklist: [
      'Put equality predicate columns before range columns in index',
      'Check covering index eligibility with INCLUDE clause',
      'Review cursor pagination vs OFFSET scan cost',
    ],
    code: `-- Goal: Optimize recent completed swaps lookup per developer
SELECT
  id,
  partner_handle,
  offer_skill,
  seek_skill,
  duration_minutes,
  completed_at
FROM swap_sessions
WHERE partner_id = 'dev_marcus'
  AND status = 'completed'
  AND completed_at >= NOW() - INTERVAL '30 days'
ORDER BY completed_at DESC
LIMIT 25;

-- Recommended composite index:
CREATE INDEX CONCURRENTLY idx_swaps_partner_status_completed
ON swap_sessions (partner_id, status, completed_at DESC)
INCLUDE (partner_handle, offer_skill, seek_skill, duration_minutes);
`,
  },
  {
    id: 'rust-ring-buffer',
    title: 'Fixed-Capacity Ring Buffer (Rust)',
    language: 'rust',
    fileName: 'ring_buffer.rs',
    summary: 'Design a zero-allocation circular buffer for streaming telemetry samples.',
    checklist: [
      'Wrap head and tail indices with modulo capacity arithmetic',
      'Handle full-buffer overwrite semantics explicitly',
      'Avoid heap allocations on push/pop hot paths',
    ],
    code: `pub struct RingBuffer<T, const N: usize> {
    buf: [Option<T>; N],
    head: usize,
    len: usize,
}

impl<T, const N: usize> RingBuffer<T, N> {
    pub fn new() -> Self {
        Self {
            buf: std::array::from_fn(|_| None),
            head: 0,
            len: 0,
        }
    }

    pub fn push(&mut self, item: T) -> Option<T> {
        let tail = (self.head + self.len) % N;
        if self.len == N {
            let overwritten = self.buf[self.head].replace(item);
            self.head = (self.head + 1) % N;
            overwritten
        } else {
            self.buf[tail] = Some(item);
            self.len += 1;
            None
        }
    }
}
`,
  },
];

export const LANGUAGE_LABELS: Record<LanguageId, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  sql: 'SQL',
};
