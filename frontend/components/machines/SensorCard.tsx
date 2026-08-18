'use client';
import { Thermometer, Vibrate, Zap, Gauge, Volume2 } from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';
import type { SensorHistory } from '@/types';

interface Props {
  type: 'temperature' | 'vibration' | 'current' | 'rpm' | 'acoustic';
  value: number;
  history?: SensorHistory[];
  compact?: boolean;
}

const CONFIG = {
  temperature: { label: 'Temperature', unit: '°C', icon: Thermometer, color: '#f97316', key: 'temperature' },
  vibration:   { label: 'Vibration',   unit: 'g',  icon: Vibrate,     color: '#FF204E', key: 'vibration' },
  current:     { label: 'Current',     unit: 'A',  icon: Zap,         color: '#8b5cf6', key: 'current' },
  rpm:         { label: 'RPM',         unit: 'rpm', icon: Gauge,       color: '#06b6d4', key: 'rpm' },
  acoustic:    { label: 'Acoustic',    unit: 'dB', icon: Volume2,      color: '#10b981', key: 'acoustic' },
};

export function SensorCard({ type, value, history = [], compact = false }: Props) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;
  const sparkData = history.slice(-20).map(h => h[cfg.key as keyof SensorHistory] as number);

  const decimals = type === 'rpm' ? 0 : type === 'vibration' ? 4 : type === 'current' ? 3 : 1;

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: compact ? '12px 14px' : '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={14} color={cfg.color} />
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', fontWeight: 600 }}>{cfg.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: compact ? '1.3rem' : '1.6rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
            {value.toFixed(decimals)}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 3 }}>{cfg.unit}</span>
        </div>
        {sparkData.length > 2 && (
          <Sparkline data={sparkData} color={cfg.color} width={60} height={32} />
        )}
      </div>
    </div>
  );
}
