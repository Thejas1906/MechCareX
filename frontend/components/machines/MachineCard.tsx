'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { healthColor, faultLabel } from '@/lib/health';
import type { MachineState } from '@/types';

interface Props {
  machine: MachineState;
}

export function MachineCard({ machine: m }: Props) {
  const hc = healthColor(m.health_breakdown?.status ?? 'HEALTHY');
  const score = m.health_score;
  const fault = m.anomalies?.probable_fault ?? 'NORMAL';

  return (
    <Link href={`/machines/${m.machine_code}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s',
        borderLeft: `4px solid ${hc}`,
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', color: '#FF204E', textTransform: 'uppercase' }}>
              {m.machine_code}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{m.name}</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>{m.machine_type}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusBadge status={m.health_breakdown?.status ?? m.status} />
            <ChevronRight size={14} color="#94a3b8" />
          </div>
        </div>

        {/* Health Score */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Health Score</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: hc, fontSize: '0.85rem' }}>{score.toFixed(1)}%</span>
          </div>
          <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: hc, borderRadius: 3, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Sensors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { l: 'Temp', v: m.sensors.temperature.toFixed(1), u: '°C' },
            { l: 'Vib', v: m.sensors.vibration.toFixed(3), u: 'g' },
            { l: 'Current', v: m.sensors.current.toFixed(2), u: 'A' },
            { l: 'RPM', v: m.sensors.rpm.toFixed(0), u: '' },
            { l: 'Acoustic', v: m.sensors.acoustic.toFixed(1), u: 'dB' },
          ].map(s => (
            <div key={s.l} style={{ background: '#f8fafc', borderRadius: 5, padding: '6px 8px' }}>
              <div style={{ fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', marginTop: 1 }}>
                {s.v}{s.u && <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: 1 }}>{s.u}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Active anomalies */}
        {fault !== 'NORMAL' && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 5, padding: '6px 10px', fontSize: '0.68rem', color: '#9a3412' }}>
            ⚠ {faultLabel(fault)}
          </div>
        )}
      </div>
    </Link>
  );
}
