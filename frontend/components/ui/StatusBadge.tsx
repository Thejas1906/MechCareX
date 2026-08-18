import { healthColor } from '@/lib/health';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  RUNNING:  { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  HEALTHY:  { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  WARNING:  { bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  DEGRADED: { bg: '#fff7ed', color: '#9a3412', dot: '#f97316' },
  CRITICAL: { bg: '#fef2f2', color: '#991b1b', dot: '#ef4444' },
  FAULT:    { bg: '#fdf2f8', color: '#7e1d5f', dot: '#a855f7' },
};

export function StatusBadge({ status, size = 'sm' }: Props) {
  const c = STATUS_COLORS[status] ?? { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' };
  const pad = size === 'md' ? '4px 12px' : '3px 8px';
  const fs = size === 'md' ? '0.72rem' : '0.62rem';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, border: `1px solid ${c.dot}40`,
      borderRadius: 4, padding: pad, fontSize: fs,
      fontWeight: 700, letterSpacing: '0.08em', color: c.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, animation: status === 'RUNNING' ? 'pulse 2s infinite' : 'none' }} />
      {status}
    </div>
  );
}
