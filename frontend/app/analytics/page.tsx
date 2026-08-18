'use client';
import { useEffect, useState } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { LoadingState } from '@/components/ui/LoadingState';
import { TrendChart } from '@/components/charts/TrendChart';
import { healthColor, faultLabel } from '@/lib/health';
import { api } from '@/lib/api';
import type { FactoryOverview } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';

export default function AnalyticsPage() {
  const { machines, history, connectionStatus, lastUpdate } = useTelemetry();
  const [overview, setOverview] = useState<FactoryOverview | null>(null);
  const machineList = Object.values(machines);
  const activeAlerts = machineList.filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  useEffect(() => {
    api.analyticsOverview().then(setOverview).catch(() => {});
    const t = setInterval(() => api.analyticsOverview().then(setOverview).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  // Health comparison bar data
  const healthBarData = machineList.map(m => ({
    name: m.machine_code,
    score: parseFloat(m.health_score.toFixed(1)),
    fill: healthColor(m.health_breakdown?.status ?? 'HEALTHY'),
  }));

  // Radar data for machine comparison
  const radarData = ['temperature', 'vibration', 'current', 'rpm', 'acoustic'].map(k => {
    const entry: Record<string, number | string> = { subject: k.charAt(0).toUpperCase() + k.slice(1) };
    machineList.forEach(m => { entry[m.machine_code] = parseFloat((m.health_breakdown?.[k as keyof typeof m.health_breakdown] ?? 100).toFixed(1)); });
    return entry;
  });

  const RADAR_COLORS = ['#FF204E', '#A0153E', '#5D0E41'];

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content">
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Analytics</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Factory-level health analysis and comparisons</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Health Comparison */}
            <div className="card">
              <div className="section-title">Machine Health Comparison</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={healthBarData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={35} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Health Score']}
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, fontSize: '0.72rem' }}
                      labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#fff' }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}
                      fill="#FF204E"
                      label={{ position: 'top', fontSize: 10, fill: '#64748b', formatter: (v: number) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sensor Health Radar */}
            <div className="card">
              <div className="section-title">Sensor Health Radar</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    {machineList.map((m, i) => (
                      <Radar key={m.machine_code} name={m.machine_code} dataKey={m.machine_code}
                        stroke={RADAR_COLORS[i]} fill={RADAR_COLORS[i]} fillOpacity={0.1} strokeWidth={1.5} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, fontSize: '0.72rem' }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Fault Distribution */}
          {overview && overview.fault_distribution.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Fault Event Distribution</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overview.fault_distribution.map(f => (
                  <div key={f.fault_type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 120, fontSize: '0.72rem', color: '#475569', flexShrink: 0 }}>{faultLabel(f.fault_type)}</div>
                    <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, f.count / (overview.reading_count || 1) * 1000)}%`, background: '#FF204E', borderRadius: 4 }} />
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#0f172a', width: 30, textAlign: 'right' }}>{f.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Trend Comparison — Temperature */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Temperature Trend Comparison</div>
            {machineList.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {machineList.map((m, i) => (
                  <div key={m.machine_code}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>{m.machine_code} — {m.name}</div>
                    <TrendChart data={history[m.machine_code] ?? []} dataKey="temperature" label="Temp" unit="°C" color={RADAR_COLORS[i]} height={120} />
                  </div>
                ))}
              </div>
            ) : <LoadingState message="Collecting data..." />}
          </div>

          {/* Database stats */}
          {overview && (
            <div className="card">
              <div className="section-title">Database Statistics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { l: 'Total Readings', v: overview.reading_count.toLocaleString() },
                  { l: 'Fault Events', v: overview.fault_distribution.reduce((s, f) => s + f.count, 0).toString() },
                  { l: 'Active Alerts', v: overview.factory.active_alerts.toString() },
                ].map(s => (
                  <div key={s.l} style={{ background: '#f8fafc', borderRadius: 6, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
