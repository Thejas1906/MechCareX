'use client';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MachineCard } from '@/components/machines/MachineCard';
import { LoadingState } from '@/components/ui/LoadingState';

export default function MachinesPage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();
  const machineList = Object.values(machines);
  const activeAlerts = machineList.filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Machines</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Real-time monitoring for all virtual machines</p>
          </div>
          {machineList.length === 0 ? (
            <LoadingState message="Connecting..." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {machineList.map(m => <MachineCard key={m.machine_code} machine={m} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
