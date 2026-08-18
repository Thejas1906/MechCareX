'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { FFTSpectrum } from '@/types';
import { faultLabel } from '@/lib/health';

interface Props {
  spectrum: FFTSpectrum;
}

export function VibrationSpectrum({ spectrum }: Props) {
  const { frequencies, amplitudes, harmonics, dominant_harmonic, components } = spectrum;

  // Downsample to ~80 points for display clarity
  const step = Math.max(1, Math.floor(frequencies.length / 80));
  const chartData = frequencies.filter((_, i) => i % step === 0).map((f, i) => ({
    freq: parseFloat(f.toFixed(1)),
    amp: amplitudes[i * step] ?? 0,
  }));

  const dominant1x = components['1x'] ?? 0;
  const dominant2x = components['2x'] ?? 0;
  const dominantComponent = dominant2x > dominant1x * 1.3 ? '2x' : '1x';
  const condition = dominantComponent === '2x' ? 'MISALIGNMENT' : 'IMBALANCE';

  const domFreq = harmonics[dominant_harmonic as '1x' | '2x' | '3x'] ?? harmonics['1x'];

  return (
    <div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barSize={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="freq" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false}
              label={{ value: 'Hz', position: 'insideBottomRight', offset: -5, fontSize: 9, fill: '#94a3b8' }}
              interval={Math.floor(chartData.length / 8)} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={50}
              tickFormatter={v => v.toFixed(4)} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, fontSize: '0.7rem' }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v: number) => [v.toFixed(6) + ' g', 'Amplitude']}
              labelFormatter={v => `${v} Hz`}
            />
            <Bar dataKey="amp" fill="#FF204E" opacity={0.8} />
            {/* Harmonic reference lines */}
            <ReferenceLine x={harmonics['1x']} stroke="#22c55e" strokeDasharray="4 2"
              label={{ value: '1×', fontSize: 8, fill: '#22c55e', position: 'top' }} />
            <ReferenceLine x={harmonics['2x']} stroke="#f59e0b" strokeDasharray="4 2"
              label={{ value: '2×', fontSize: 8, fill: '#f59e0b', position: 'top' }} />
            <ReferenceLine x={harmonics['3x']} stroke="#8b5cf6" strokeDasharray="4 2"
              label={{ value: '3×', fontSize: 8, fill: '#8b5cf6', position: 'top' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Harmonic components summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
        {(['1x', '2x', '3x'] as const).map(h => (
          <div key={h} style={{
            background: '#f8fafc', borderRadius: 6, padding: '8px 10px',
            border: `1px solid ${dominant_harmonic === h ? '#FF204E' : '#e2e8f0'}`,
          }}>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{h} RPM</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
              {(components[h] ?? 0).toFixed(4)} g
            </div>
            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>{harmonics[h]} Hz</div>
          </div>
        ))}
      </div>

      {/* Diagnostic */}
      {dominant_harmonic !== 'other' && (
        <div style={{ marginTop: 12, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7e22ce', marginBottom: 4 }}>Spectrum Diagnosis</div>
          <div style={{ fontSize: '0.78rem', color: '#1e293b' }}>
            Dominant component: <strong>{dominant_harmonic} RPM</strong> ({domFreq.toFixed(1)} Hz)
          </div>
          {(dominant_harmonic === '1x' && components['1x'] > components['2x'] * 2.5) && (
            <div style={{ fontSize: '0.7rem', color: '#7e22ce', marginTop: 3 }}>Possible condition: Mechanical Imbalance</div>
          )}
          {(dominant_harmonic === '2x' && components['2x'] > components['1x'] * 1.3) && (
            <div style={{ fontSize: '0.7rem', color: '#7e22ce', marginTop: 3 }}>Possible condition: Shaft Misalignment</div>
          )}
          {dominant_harmonic === '3x' && (
            <div style={{ fontSize: '0.7rem', color: '#7e22ce', marginTop: 3 }}>Elevated super-harmonic — possible bearing noise</div>
          )}
        </div>
      )}
    </div>
  );
}
