'use client';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { Alert } from '@/types';
import { faultLabel } from '@/lib/health';

const ICONS = { CRITICAL: AlertCircle, WARNING: AlertTriangle, INFO: Info, NORMAL: Info };
const COLORS = { CRITICAL: '#ef4444', WARNING: '#f59e0b', INFO: '#60a5fa', NORMAL: '#22c55e' };

function ago(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function AlertCard({ alert }: { alert: Alert }) {
  const color = COLORS[alert.severity] ?? '#94a3b8';
  const Icon = ICONS[alert.severity] ?? Info;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '14px 16px', borderLeft: `4px solid ${color}`,
      opacity: alert.status === 'RESOLVED' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon size={16} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>
              {alert.severity}
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#FF204E' }}>{alert.machine_code}</span>
            {alert.status === 'RESOLVED' && (
              <span style={{ fontSize: '0.6rem', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 3, padding: '1px 6px' }}>RESOLVED</span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
            {faultLabel(alert.probable_fault)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: 6 }}>{alert.message}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {alert.anomalies.map(a => (
              <span key={a} style={{ fontSize: '0.58rem', background: `${color}15`, color, border: `1px solid ${color}30`, borderRadius: 3, padding: '1px 6px' }}>
                {a.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 6 }}>{ago(alert.created_at)}</div>
        </div>
      </div>
    </div>
  );
}
