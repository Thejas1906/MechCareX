'use client';
import type { ConnectionStatus } from '@/types';

interface Props {
  connectionStatus: ConnectionStatus;
  lastUpdate: number | null;
}

export function Topbar({ connectionStatus, lastUpdate }: Props) {
  const age = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : null;

  const indicator = {
    connected: { color: '#22c55e', label: 'LIVE' },
    connecting: { color: '#f59e0b', label: 'CONNECTING' },
    disconnected: { color: '#f59e0b', label: 'RECONNECTING' },
    error: { color: '#ef4444', label: 'OFFLINE' },
  }[connectionStatus];

  return (
    <div style={{
      height: 52, background: '#fff', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0,
    }}>
      <div style={{ fontSize: '0.7rem', color: '#8a9ab5', letterSpacing: '0.05em' }}>
        Industrial Monitoring Dashboard — Phase 2
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {age !== null && (
          <span style={{ fontSize: '0.65rem', color: '#8a9ab5' }}>
            Last update: {age === 0 ? 'just now' : `${age}s ago`}
          </span>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: `${indicator.color}15`, border: `1px solid ${indicator.color}40`,
          borderRadius: 4, padding: '3px 10px',
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: indicator.color,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: indicator.color, display: 'inline-block', animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none' }} />
          {indicator.label}
        </div>
      </div>
    </div>
  );
}
