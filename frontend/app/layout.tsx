import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MechCareX — Industrial Monitoring',
  description: 'IoT-Based Predictive Maintenance and Real-Time Health Monitoring for Rotating Machines',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
