'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SensorHistory } from '@/types';

interface Props {
  data: SensorHistory[];
  dataKey: keyof SensorHistory;
  label: string;
  unit: string;
  color?: string;
  height?: number;
}

export function TrendChart({ data, dataKey, label, unit, color = '#FF204E', height = 180 }: Props) {
  const chartData = data.map(d => ({
    t: new Date(d.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    v: d[dataKey] as number,
  }));

  if (chartData.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
        Collecting data...
      </div>
    );
  }

  const values = chartData.map(d => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
            tickFormatter={v => v.toFixed(dataKey === 'rpm' ? 0 : 2)}
            width={45}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, fontSize: '0.72rem' }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: color }}
            formatter={(v: number) => [`${v.toFixed(3)} ${unit}`, label]}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false}
            animationDuration={300} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
