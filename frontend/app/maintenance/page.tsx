'use client';
import { useState, useEffect } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { LoadingState, EmptyState } from '@/components/ui/LoadingState';
import { api } from '@/lib/api';
import type { MaintenanceRecord } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#3b82f6', MEDIUM: '#ca8a04', HIGH: '#ea580c', CRITICAL: '#dc2626',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: '#dc2626', IN_PROGRESS: '#ca8a04', COMPLETED: '#16a34a',
};

export default function MaintenancePage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const activeAlerts = Object.values(machines).filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  async function load() {
    try {
      const data = await api.listMaintenance();
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function advanceStatus(rec: MaintenanceRecord) {
    const next = rec.status === 'OPEN' ? 'IN_PROGRESS' : rec.status === 'IN_PROGRESS' ? 'COMPLETED' : null;
    if (!next) return;
    setUpdating(rec.id);
    try {
      const updated = await api.updateMaintenance(rec.id, { status: next });
      setRecords(prev => prev.map(r => r.id === rec.id ? updated : r));
    } finally {
      setUpdating(null);
    }
  }

  const open = records.filter(r => r.status === 'OPEN');
  const inProgress = records.filter(r => r.status === 'IN_PROGRESS');
  const completed = records.filter(r => r.status === 'COMPLETED');

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content" style={{ maxWidth: 860 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Maintenance</h1>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Track and manage maintenance actions for all machines.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem' }}>
              {[
                { l: 'Open', v: open.length, c: '#dc2626' },
                { l: 'In Progress', v: inProgress.length, c: '#ca8a04' },
                { l: 'Completed', v: completed.length, c: '#16a34a' },
              ].map(s => (
                <div key={s.l} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: s.c, fontSize: '1.1rem' }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {loading ? <LoadingState /> : records.length === 0 ? (
            <EmptyState message="No maintenance records yet. Create one from a machine detail page or AI insights." />
          ) : (
            <>
              {[
                { title: 'Open', items: open },
                { title: 'In Progress', items: inProgress },
                { title: 'Completed', items: completed },
              ].map(({ title, items }) => items.length > 0 && (
                <div key={title} style={{ marginBottom: 24 }}>
                  <div className="section-title">{title} ({items.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map(rec => (
                      <div key={rec.id} className="card" style={{ borderLeft: `3px solid ${STATUS_COLORS[rec.status]}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#FF204E', fontWeight: 700 }}>{rec.machine_code}</span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 8 }}>{rec.machine_name}</span>
                            {rec.fault_type && <span style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#475569', padding: '1px 7px', borderRadius: 10, marginLeft: 8 }}>{rec.fault_type}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: PRIORITY_COLORS[rec.priority], background: PRIORITY_COLORS[rec.priority] + '20', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{rec.priority}</span>
                            <span style={{ fontSize: '0.65rem', color: STATUS_COLORS[rec.status], background: STATUS_COLORS[rec.status] + '15', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{rec.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, marginBottom: 4 }}>{rec.issue}</div>
                        <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 8 }}>→ {rec.recommended_action}</div>
                        {rec.notes && <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginBottom: 8 }}>{rec.notes}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Created {new Date(rec.created_at).toLocaleString()}</span>
                          {rec.status !== 'COMPLETED' && (
                            <button
                              onClick={() => advanceStatus(rec)}
                              disabled={updating === rec.id}
                              style={{
                                padding: '5px 14px', borderRadius: 6, border: 'none',
                                background: rec.status === 'OPEN' ? '#ca8a04' : '#16a34a',
                                color: '#fff', fontSize: '0.72rem', fontWeight: 600,
                                cursor: updating === rec.id ? 'not-allowed' : 'pointer',
                              }}>
                              {updating === rec.id ? '...' : rec.status === 'OPEN' ? '→ In Progress' : '→ Complete'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
