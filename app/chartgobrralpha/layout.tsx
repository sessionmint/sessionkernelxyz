import type { ReactNode } from 'react';

export default function ChartGoBrrAlphaLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c' }}>
      {children}
    </div>
  );
}
