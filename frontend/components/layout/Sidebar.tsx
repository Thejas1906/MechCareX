'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Server, BarChart2, Bell, Brain, Wrench, FileText, PlayCircle } from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/machines', label: 'Machines', icon: Server },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/ai-insights', label: 'AI Insights', icon: Brain },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/demo', label: 'Demo Mode', icon: PlayCircle },
];

export function Sidebar({ alertCount = 0 }: { alertCount?: number }) {
  const path = usePathname();

  return (
    <aside style={{ width: 220, height: '100vh', background: '#00224D', borderRight: '1px solid #1e3358', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1e3358' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RotaryIcon />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>MechCareX</div>
            <div style={{ fontSize: '0.55rem', color: '#8a9ab5', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Predictive Maintenance</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        <div style={{ fontSize: '0.55rem', color: '#8a9ab5', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 12px 6px' }}>Navigation</div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div className={clsx('sidebar-nav-item', active && 'active')} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 6, marginBottom: 2,
                color: active ? '#fff' : '#8a9ab5',
                background: active ? '#FF204E' : 'transparent',
                fontSize: '0.82rem', fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <Icon size={16} />
                <span style={{ flex: 1 }}>{label}</span>
                {label === 'Alerts' && alertCount > 0 && (
                  <span style={{ background: '#FF204E', color: '#fff', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', display: active ? 'none' : 'block' }}>
                    {alertCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e3358', fontSize: '0.6rem', color: '#8a9ab5' }}>
        <div>MechCareX v3.0 — Phase 3</div>
        <div style={{ marginTop: 2, color: '#5D0E41' }}>Virtual IoT Prototype</div>
      </div>
    </aside>
  );
}

function RotaryIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke="#FF204E" strokeWidth="2" fill="none" />
      <circle cx="16" cy="16" r="5" fill="#FF204E" />
      <line x1="16" y1="2" x2="16" y2="8" stroke="#FF204E" strokeWidth="2" />
      <line x1="16" y1="24" x2="16" y2="30" stroke="#FF204E" strokeWidth="2" />
      <line x1="2" y1="16" x2="8" y2="16" stroke="#FF204E" strokeWidth="2" />
      <line x1="24" y1="16" x2="30" y2="16" stroke="#FF204E" strokeWidth="2" />
    </svg>
  );
}
