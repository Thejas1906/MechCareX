export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#FF204E', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: '0.8rem', color: '#8a9ab5' }}>{message}</div>
    </div>
  );
}

export function ErrorState({ message = 'Failed to load data.' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⚠</div>
      <div style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', maxWidth: 280 }}>{message}</div>
    </div>
  );
}

export function EmptyState({ message = 'No data available.' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120, gap: 8 }}>
      <div style={{ fontSize: '0.75rem', color: '#8a9ab5', textAlign: 'center' }}>{message}</div>
    </div>
  );
}
