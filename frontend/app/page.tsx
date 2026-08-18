'use client';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MachineCard } from '@/components/machines/MachineCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { faultLabel, healthColor } from '@/lib/health';
import type { MachineState } from '@/types';

export default function DashboardPage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();

  const machineList = Object.values(machines) as MachineState[];
  const healthy = machineList.filter(m => m.health_score >= 90).length;
  const warning = machineList.filter(m => m.health_score >= 70 && m.health_score < 90).length;
  const degraded = machineList.filter(m => m.health_score >= 40 && m.health_score < 70).length;
  const critical = machineList.filter(m => m.health_score < 40).length;

  const activeAlerts = machineList.filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;
  const worstMachine = machineList.sort((a, b) => a.health_score - b.health_score)[0];

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748b', marginBottom: 4 }}>
              Virtual Factory — 3 Machines Online
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>Monitoring Dashboard</h1>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Total Machines', value: 3, color: '#00224D', bg: '#eff6ff' },
              { label: 'Healthy', value: healthy, color: '#15803d', bg: '#f0fdf4' },
              { label: 'Warning', value: warning, color: '#92400e', bg: '#fffbeb' },
              { label: 'Degraded', value: degraded, color: '#9a3412', bg: '#fff7ed' },
              { label: 'Critical', value: critical, color: '#991b1b', bg: '#fef2f2' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}20`, borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: c.color, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 28 }}>
            {/* Machine Cards */}
            <div>
              <div className="section-title">Machine Status</div>
              {machineList.length === 0 ? (
                <LoadingState message="Connecting to simulation engine..." />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {machineList.map(m => <MachineCard key={m.machine_code} machine={m} />)}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Factory Status */}
              <div className="card">
                <div className="section-title">Factory Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem' }}>
                  {[
                    { l: 'Total Machines', v: '3' },
                    { l: 'Healthy', v: String(healthy) },
                    { l: 'Needs Attention', v: String(warning + degraded + critical) },
                    { l: 'Active Anomalies', v: String(activeAlerts) },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>{r.l}</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: '#64748b' }}>System</span>
                    <span style={{ color: connectionStatus === 'connected' ? '#22c55e' : '#f59e0b', fontWeight: 700, fontSize: '0.72rem' }}>
                      ● {connectionStatus === 'connected' ? 'LIVE' : 'RECONNECTING'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Worst machine attention */}
              {worstMachine && worstMachine.health_score < 90 && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a3412', marginBottom: 8 }}>
                    ⚠ Attention Required
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{worstMachine.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 8 }}>{worstMachine.machine_code}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Health</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: healthColor(worstMachine.health_breakdown?.status ?? 'WARNING') }}>
                      {worstMachine.health_score.toFixed(1)}%
                    </span>
                  </div>
                  {worstMachine.anomalies?.probable_fault !== 'NORMAL' && (
                    <div style={{ fontSize: '0.7rem', color: '#9a3412' }}>
                      Probable: {faultLabel(worstMachine.anomalies.probable_fault)}
                    </div>
                  )}
                  <div style={{ fontSize: '0.62rem', color: '#f97316', marginTop: 4 }}>
                    {worstMachine.anomalies?.anomaly_count ?? 0} active anomalies
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="card">
                <div className="section-title">Quick Access</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['M01', 'M02', 'M03'].map(code => {
                    const m = machines[code];
                    return (
                      <a key={code} href={`/machines/${code}`} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '7px 10px', background: '#f8fafc', borderRadius: 6, fontSize: '0.75rem',
                        border: '1px solid #e2e8f0',
                      }}>
                        <span style={{ fontWeight: 600 }}>{code}</span>
                        {m ? (
                          <span style={{ fontFamily: 'monospace', color: healthColor(m.health_breakdown?.status ?? 'HEALTHY') }}>
                            {m.health_score.toFixed(0)}%
                          </span>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
