'use client';
import { useEffect, useState } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AlertCard } from '@/components/alerts/AlertCard';
import { LoadingState, EmptyState } from '@/components/ui/LoadingState';
import { api } from '@/lib/api';
import type { Alert } from '@/types';

export default function AlertsPage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const activeAlerts = Object.values(machines).filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  useEffect(() => {
    const fetch = () => api.alerts().then(a => { setAlerts(a); setLoading(false); }).catch(() => setLoading(false));
    fetch();
    const t = setInterval(fetch, 3000);
    return () => clearInterval(t);
  }, []);

  const active = alerts.filter(a => a.status === 'ACTIVE');
  const resolved = alerts.filter(a => a.status === 'RESOLVED');

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content" style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Alerts</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
              Active anomalies and event history
            </p>
          </div>

          {loading ? <LoadingState /> : (
            <>
              {/* Active */}
              <div style={{ marginBottom: 24 }}>
                <div className="section-title">
                  Active Alerts
                  {active.length > 0 && (
                    <span style={{ marginLeft: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '0.6rem', padding: '1px 7px', fontWeight: 700 }}>
                      {active.length}
                    </span>
                  )}
                </div>
                {active.length === 0 ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>✓ All machines operating normally</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>No active anomalies detected</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {active.map(a => <AlertCard key={a.id} alert={a} />)}
                  </div>
                )}
              </div>

              {/* Resolved */}
              {resolved.length > 0 && (
                <div>
                  <div className="section-title">Resolved</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {resolved.map(a => <AlertCard key={a.id} alert={a} />)}
                  </div>
                </div>
              )}

              {alerts.length === 0 && <EmptyState message="No alerts recorded in this session." />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
