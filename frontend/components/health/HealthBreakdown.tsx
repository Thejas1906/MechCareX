'use client';
import type { HealthBreakdown } from '@/types';

const WEIGHTS = { temperature: 20, vibration: 30, current: 20, rpm: 15, acoustic: 15 };
const LABELS: Record<string, string> = {
  temperature: 'Temperature', vibration: 'Vibration',
  current: 'Current', rpm: 'RPM', acoustic: 'Acoustic',
};

function scoreColor(v: number): string {
  if (v >= 85) return '#22c55e';
  if (v >= 70) return '#f59e0b';
  if (v >= 50) return '#f97316';
  return '#ef4444';
}

export function HealthBreakdownPanel({ breakdown }: { breakdown: HealthBreakdown }) {
  const keys = ['temperature', 'vibration', 'current', 'rpm', 'acoustic'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {keys.map(k => {
        const v = breakdown[k];
        const c = scoreColor(v);
        return (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                {LABELS[k]}
                <span style={{ fontSize: '0.58rem', color: '#94a3b8', marginLeft: 5 }}>({WEIGHTS[k]}%)</span>
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: c }}>{v.toFixed(1)}%</span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${v}%`, background: c, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HealthScoreRing({ score, status }: { score: number; status: string }) {
  const c = { HEALTHY: '#22c55e', WARNING: '#f59e0b', DEGRADED: '#f97316', CRITICAL: '#ef4444' }[status] ?? '#94a3b8';
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={c} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700, color: c }}>{score.toFixed(0)}</div>
        <div style={{ fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Health</div>
      </div>
    </div>
  );
}
